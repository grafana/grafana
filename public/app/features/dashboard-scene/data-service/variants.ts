import { type DataFrame, LoadingState, type PanelData, type TimeRange } from '@grafana/data';
import {
  LocalValueVariable,
  SceneObjectBase,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  sceneGraph,
  type SceneDataProvider,
  type SceneObject,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { applyPanelFieldOverrides, LOAD_TIMEOUT_MS, OFF_SCREEN_WIDTH } from './sources';

/** Keeps a breakdown over many panels from flooding the datasources. Shared by every capture. */
const MAX_CONCURRENT_LOADS = 4;

/** What to change when running a panel's queries; everything else comes from the dashboard. */
export interface PanelVariant {
  timeRange?: { from: string; to: string };
  variable?: { name: string; value: string; text: string };
}

interface VariantContextState extends SceneObjectState {
  $data: SceneDataProvider;
}

/**
 * A detached parent for a copy of a panel's data provider. Lookups it does not override (other
 * variables, the datasource, ad hoc filters, data layers) continue to the panel, which never lists it as a
 * child, so running the copy changes nothing the dashboard shows.
 */
class VariantContext extends SceneObjectBase<VariantContextState> {
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

/** A variant's copy runs under its host panel, so its state changes bubble up through the dashboard. */
export function isInVariant(object: SceneObject): boolean {
  for (let current: SceneObject | undefined = object; current; current = current.parent) {
    if (current instanceof VariantContext) {
      return true;
    }
  }
  return false;
}

function getInnermostProvider(provider: SceneDataProvider): SceneDataProvider {
  let inner = provider;
  while (inner.state.$data) {
    inner = inner.state.$data;
  }
  return inner;
}

/** A panel reusing another panel's results would report that panel's live data, not the variant. */
export function usesDashboardQueries(panel: VizPanel): boolean {
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

export function usesVariable(panel: VizPanel, name: string): boolean {
  return getVariableNames(panel).includes(name);
}

/** The variables the panel's data providers depend on, from the outer provider inwards. */
export function getVariableNames(panel: VizPanel): string[] {
  const names = new Set<string>();
  for (
    let provider: SceneDataProvider | undefined = sceneGraph.getData(panel);
    provider;
    provider = provider.state.$data
  ) {
    for (const name of provider.variableDependency?.getNames() ?? []) {
      names.add(name);
    }
  }
  return [...names];
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

let activeLoads = 0;
const waitingLoads: Array<() => void> = [];

/** A finished load hands its slot to the next waiting one, so the limit holds across captures. */
async function withLoadSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads++;
  } else {
    await new Promise<void>((resolve) => waitingLoads.push(resolve));
  }
  try {
    return await task();
  } finally {
    const next = waitingLoads.shift();
    if (next) {
      next();
    } else {
      activeLoads--;
    }
  }
}

/** Runs a copy of the panel's queries in the variant, without rendering it or touching the panel. Undefined when it didn't load in time. */
export function loadVariantData(
  panel: VizPanel,
  variant: PanelVariant,
  signal: AbortSignal
): Promise<PanelData | undefined> {
  return withLoadSlot(async () => {
    // Loads queued behind the limit start in a burst once the caller aborts, so they must not run queries.
    if (signal.aborted) {
      return undefined;
    }
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
    const context = new VariantContext(state, panel);

    // Without a width the runner waits for one before running its queries.
    if (!hasMeasuredWidth(copy)) {
      copy.setContainerWidth?.(OFF_SCREEN_WIDTH);
    }
    const range = sceneGraph.getTimeRange(copy).state.value;
    const deactivate = context.activate();
    try {
      const data = await waitForData(copy, range, signal);
      return data && applyPanelFieldOverrides(panel, data);
    } finally {
      deactivate();
    }
  });
}
