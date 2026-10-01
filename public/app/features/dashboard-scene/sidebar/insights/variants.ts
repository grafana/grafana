import { type DataFrame, LoadingState, type PanelData, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  LocalValueVariable,
  MultiValueVariable,
  SceneObjectBase,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  sceneGraph,
  type SceneDataProvider,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { applyInsightFieldOverrides, type InsightSourcePanel, LOAD_TIMEOUT_MS, OFF_SCREEN_WIDTH } from './sources';
import { type InsightContext } from './types';

/** Each value multiplies the queries run and the data sent, so a breakdown covers at most this many. */
export const MAX_BREAKDOWN_VALUES = 8;
/** Keeps a breakdown over many panels from flooding the datasources. */
const MAX_CONCURRENT_LOADS = 4;

/** What to change when running a source panel's queries; everything else comes from the dashboard. */
export interface InsightVariant {
  timeRange?: { from: string; to: string };
  variable?: { name: string; value: string; text: string };
}

/** Keyed by source panel key. Undefined when the panel did not load in time. */
export type InsightVariantPanels = Map<string, PanelData | undefined>;

export interface InsightVariantsData {
  previousPeriod?: { from: string; to: string; panels: InsightVariantPanels };
  breakdown?: {
    variable: string;
    omittedValues: number;
    values: Array<{ value: string; text: string; panels: InsightVariantPanels; previousPeriod?: InsightVariantPanels }>;
  };
}

export interface InsightVariantRequest {
  compareWithPreviousPeriod?: boolean;
  breakdownVariable?: string;
}

interface VariantContextState extends SceneObjectState {
  $data: SceneDataProvider;
}

/**
 * A detached parent for a copy of a source panel's data provider. Lookups it does not override (other
 * variables, the datasource, ad hoc filters, data layers) continue to the panel, which never lists it as a
 * child, so running the copy changes nothing the dashboard shows.
 */
class InsightVariantContext extends SceneObjectBase<VariantContextState> {
  // The copy's transformer reads system transformations from its parent, which for the live data is the panel.
  public readonly isSystemTransformationsProvider = true;

  public constructor(
    state: VariantContextState,
    private host: VizPanel
  ) {
    super(state);
    this._parent = host;
  }

  public get origin() {
    return this.host.origin;
  }

  public getSystemTransformations(ctx: { series: DataFrame[] }) {
    return this.host.getSystemTransformations(ctx);
  }
}

function getInnermostProvider(provider: SceneDataProvider): SceneDataProvider {
  let inner = provider;
  while (inner.state.$data) {
    inner = inner.state.$data;
  }
  return inner;
}

/** A panel reusing another panel's results would report that panel's live data, not the variant. */
function usesDashboardQueries(panel: VizPanel): boolean {
  const runner = getInnermostProvider(sceneGraph.getData(panel));
  if (!(runner instanceof SceneQueryRunner)) {
    return false;
  }
  const { datasource, queries } = runner.state;
  return (
    datasource?.uid === SHARED_DASHBOARD_QUERY ||
    queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY)
  );
}

function usesVariable(panel: VizPanel, name: string): boolean {
  for (
    let provider: SceneDataProvider | undefined = sceneGraph.getData(panel);
    provider;
    provider = provider.state.$data
  ) {
    if (provider.variableDependency?.hasDependencyOn(name)) {
      return true;
    }
  }
  return false;
}

function hasMeasuredWidth(provider: SceneDataProvider): boolean {
  const runner = getInnermostProvider(provider);
  return '_containerWidth' in runner && typeof runner._containerWidth === 'number' && runner._containerWidth > 0;
}

function isLoadedFor(data: PanelData | undefined, range: TimeRange): data is PanelData {
  return Boolean(
    data &&
      (data.state === LoadingState.Done || data.state === LoadingState.Error) &&
      data.timeRange.from.valueOf() === range.from.valueOf() &&
      data.timeRange.to.valueOf() === range.to.valueOf()
  );
}

function waitForData(provider: SceneDataProvider, range: TimeRange, signal: AbortSignal) {
  return new Promise<PanelData | undefined>((resolve) => {
    const finish = (data?: PanelData) => {
      clearTimeout(timer);
      subscription.unsubscribe();
      signal.removeEventListener('abort', onAbort);
      resolve(data);
    };
    const onAbort = () => finish();
    const timer = setTimeout(() => finish(), LOAD_TIMEOUT_MS);
    const subscription = provider.subscribeToState(({ data }) => {
      if (isLoadedFor(data, range)) {
        finish(data);
      }
    });
    signal.addEventListener('abort', onAbort);
    const current = provider.state.data;
    if (signal.aborted) {
      finish();
    } else if (isLoadedFor(current, range)) {
      finish(current);
    }
  });
}

/** Runs a copy of the panel's queries in the variant, without rendering it or touching the panel. */
async function loadVariantData(panel: VizPanel, variant: InsightVariant, signal: AbortSignal) {
  const copy = sceneGraph.getData(panel).clone();
  for (let provider: SceneDataProvider | undefined = copy; provider; provider = provider.state.$data) {
    provider.setState({ data: undefined });
  }

  const state: VariantContextState = { $data: copy };
  if (variant.timeRange) {
    state.$timeRange = new SceneTimeRange({
      ...variant.timeRange,
      timeZone: sceneGraph.getTimeRange(panel).getTimeZone(),
    });
  }
  if (variant.variable) {
    const { name, value, text } = variant.variable;
    state.$variables = new SceneVariableSet({ variables: [new LocalValueVariable({ name, value, text })] });
  }
  const context = new InsightVariantContext(state, panel);

  // Without a width the runner waits for one before running its queries.
  if (!hasMeasuredWidth(copy)) {
    copy.setContainerWidth?.(OFF_SCREEN_WIDTH);
  }
  const range = sceneGraph.getTimeRange(copy).state.value;
  const deactivate = context.activate();
  try {
    const data = await waitForData(copy, range, signal);
    return data && applyInsightFieldOverrides(panel, data);
  } finally {
    deactivate();
  }
}

async function runLimited<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_LOADS, tasks.length) }, worker));
  return results;
}

/** The values selected in the variable, or every value when All is selected. */
function getBreakdownValues(variable: MultiValueVariable) {
  const { options, value } = variable.state;
  const selected = (Array.isArray(value) ? value : [value]).map(String);
  const chosen =
    selected.includes(ALL_VARIABLE_VALUE) || selected.every((item) => item === '')
      ? options
      : options.filter((option) => selected.includes(String(option.value)));
  return {
    values: chosen
      .slice(0, MAX_BREAKDOWN_VALUES)
      .map((option) => ({ value: String(option.value), text: option.label })),
    omittedValues: Math.max(0, chosen.length - MAX_BREAKDOWN_VALUES),
  };
}

/** The period just before the time range, as long as it. */
export function getPreviousPeriod(context: InsightContext): { from: string; to: string } {
  const from = Date.parse(context.from);
  const to = Date.parse(context.to);
  return { from: new Date(from - (to - from)).toISOString(), to: context.from };
}

/**
 * Captures the selected sources over the previous period, once per breakdown value, or both. Throws a
 * user-facing message when a variant cannot be captured faithfully.
 */
export async function loadInsightVariants(
  dashboard: DashboardSceneLike,
  sources: InsightSourcePanel[],
  context: InsightContext,
  request: InsightVariantRequest,
  signal: AbortSignal
): Promise<InsightVariantsData> {
  const breakdownName = request.breakdownVariable?.trim();
  if (!request.compareWithPreviousPeriod && !breakdownName) {
    return {};
  }

  const reusing = sources.find((source) => usesDashboardQueries(source.panel));
  if (reusing) {
    throw new Error(
      t(
        'dashboard.insights.variants.dashboard-queries',
        '“{{title}}” reuses another panel’s query, so it cannot be compared or broken down. Remove it from the sources or turn those options off.',
        { title: reusing.title }
      )
    );
  }

  const previousPeriod = request.compareWithPreviousPeriod ? getPreviousPeriod(context) : undefined;
  const load = (panels: InsightSourcePanel[], variant: InsightVariant) =>
    panels.map((source) => async () => [source.key, await loadVariantData(source.panel, variant, signal)] as const);

  let breakdownPlan: Array<{ value: string; text: string; variable: InsightVariant['variable'] }> = [];
  let breakdownSources: InsightSourcePanel[] = [];
  let omittedValues = 0;
  if (breakdownName) {
    const variable = sceneGraph.lookupVariable(breakdownName, dashboard);
    if (!(variable instanceof MultiValueVariable)) {
      throw new Error(
        t(
          'dashboard.insights.variants.variable-missing',
          'The variable “{{name}}” this question is broken down by is no longer on the dashboard. Edit the question to pick another.',
          { name: breakdownName }
        )
      );
    }
    breakdownSources = sources.filter((source) => usesVariable(source.panel, breakdownName));
    if (!breakdownSources.length) {
      throw new Error(
        t(
          'dashboard.insights.variants.variable-unused',
          'None of the source panels use the variable “{{name}}”, so breaking down by it would repeat the same data.',
          { name: breakdownName }
        )
      );
    }
    const values = getBreakdownValues(variable);
    omittedValues = values.omittedValues;
    breakdownPlan = values.values.map((option) => ({
      ...option,
      variable: { name: breakdownName, value: option.value, text: option.text },
    }));
  }

  // One flat task list, so the concurrency limit applies across every variant.
  const groups: Array<Array<() => Promise<readonly [string, PanelData | undefined]>>> = [];
  if (previousPeriod) {
    groups.push(load(sources, { timeRange: previousPeriod }));
  }
  for (const value of breakdownPlan) {
    groups.push(load(breakdownSources, { variable: value.variable }));
    if (previousPeriod) {
      groups.push(load(breakdownSources, { variable: value.variable, timeRange: previousPeriod }));
    }
  }
  const results = await runLimited(groups.flat());
  let offset = 0;
  const take = (count: number): InsightVariantPanels => {
    const panels = new Map(results.slice(offset, offset + count));
    offset += count;
    return panels;
  };

  const data: InsightVariantsData = {};
  if (previousPeriod) {
    data.previousPeriod = { ...previousPeriod, panels: take(sources.length) };
  }
  if (breakdownName) {
    data.breakdown = {
      variable: breakdownName,
      omittedValues,
      values: breakdownPlan.map(({ value, text }) => ({
        value,
        text,
        panels: take(breakdownSources.length),
        previousPeriod: previousPeriod ? take(breakdownSources.length) : undefined,
      })),
    };
  }
  return data;
}
