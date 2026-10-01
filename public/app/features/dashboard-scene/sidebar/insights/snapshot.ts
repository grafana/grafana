import {
  type DataFrame,
  type Field,
  FieldType,
  getFieldDisplayName,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import {
  DASHBOARD_SOURCE_REF,
  getMissingRefLabel,
  getMissingSectionRefs,
  getPanelLocation,
  resolveInsightSourceKeys,
} from './sections';
import { getInsightSourceData, getInsightSourcePanels, type InsightSourcePanel } from './sources';
import {
  type InsightContext,
  type InsightFieldStats,
  type InsightQuestion,
  type InsightSnapshot,
  type InsightSnapshotAnnotation,
  type InsightSnapshotField,
  type InsightSnapshotFrame,
  type InsightSnapshotPanel,
} from './types';
import { type InsightVariantPanels, type InsightVariantsData } from './variants';

export const MAX_INSIGHT_INPUT_CHARACTERS = 100_000;
const SUMMARY_BUCKETS = 60;

// The note travels with the data so follow-up chats, which use a different prompt, read summaries correctly.
const SUMMARY_NOTE =
  'Too many points to send exactly. Time values are bucket start times. Numeric values are the mean of each bucket, or null when a bucket has no points. Each numeric field’s stats are exact over all original points.';

/** A source is off screen and has not run its query yet; asking loads it. */
export class InsightSourceNotLoadedError extends Error {}

export function getInsightContext(dashboard: DashboardSceneLike, question: string): InsightContext {
  const timeRange = sceneGraph.getTimeRange(dashboard).state.value;
  const variables: Record<string, string> = {};
  for (const variable of sceneGraph.getVariables(dashboard)?.state.variables ?? []) {
    const name = variable.state.name;
    variables[name] = sceneGraph.interpolate(dashboard, `\${${name}}`);
  }
  return {
    question,
    dashboardUid: dashboard.state.uid ?? '',
    from: timeRange.from.toISOString(),
    to: timeRange.to.toISOString(),
    variables,
  };
}

type InsightSourceWithData = Pick<InsightSourcePanel, 'key' | 'title' | 'description'> & {
  section?: string;
  /** False when the panel is off screen, for example in another tab, so its data only loads on request. */
  active: boolean;
  data?: PanelData;
};

function readySeries(source: InsightSourceWithData, context: InsightContext): DataFrame[] {
  const { data, title } = source;
  const notLoaded = t(
    'dashboard.insights.snapshot.source-not-loaded',
    '“{{title}}” hasn’t loaded yet. Open it on the dashboard, then ask again.',
    { title }
  );
  if (!data || data.state === LoadingState.NotStarted) {
    throw new InsightSourceNotLoadedError(notLoaded);
  }
  if (data.state !== LoadingState.Done) {
    throw new Error(
      t(
        'dashboard.insights.snapshot.source-not-ready',
        '“{{title}}” is not ready. Wait for its query to finish successfully, then try again.',
        { title }
      )
    );
  }
  if (data.error || data.errors?.length) {
    throw new Error(
      t(
        'dashboard.insights.snapshot.source-error',
        '“{{title}}” has a query error. Resolve it before asking Assistant.',
        { title }
      )
    );
  }
  // Panel time overrides are not supported: refuse to describe mismatched ranges as one dashboard interval.
  if (
    data.timeRange &&
    (data.timeRange.from.toISOString() !== context.from || data.timeRange.to.toISOString() !== context.to)
  ) {
    if (!source.active) {
      throw new InsightSourceNotLoadedError(notLoaded);
    }
    throw new Error(
      t(
        'dashboard.insights.snapshot.source-time-range',
        '“{{title}}” uses a different time range. Wait for it to refresh or select matching panels.',
        { title }
      )
    );
  }
  return data.series;
}

function hasRows(series: DataFrame[]): boolean {
  return series.some((frame) => frame.length > 0 && frame.fields.length > 0);
}

function exactField(field: Field, frame: DataFrame, series: DataFrame[]): InsightSnapshotField {
  return {
    name: getFieldDisplayName(field, frame, series),
    type: field.type,
    unit: field.config.unit,
    labels: field.labels,
    values: Array.from(field.values),
  };
}

/** Stats while scanning; times stay epoch milliseconds until the result is serialized. */
type RunningStats = Record<Exclude<keyof InsightFieldStats, 'mean'> | 'sum', number>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Number(value.toPrecision(6));
}

/** Only wide numeric time series can be averaged without dropping or reinterpreting values. */
function summarizeFrame(frame: DataFrame, series: DataFrame[]): InsightSnapshotFrame | undefined {
  const timeFields = frame.fields.filter((field) => field.type === FieldType.time);
  if (
    frame.length <= SUMMARY_BUCKETS ||
    timeFields.length !== 1 ||
    frame.fields.length < 2 ||
    frame.fields.some((field) => field.type !== FieldType.time && field.type !== FieldType.number)
  ) {
    return undefined;
  }
  const values: unknown[] = Array.from(timeFields[0].values);
  if (!values.every(isFiniteNumber)) {
    return undefined;
  }
  const times: number[] = values;
  const start = times.reduce((min, time) => Math.min(min, time));
  const end = times.reduce((max, time) => Math.max(max, time));
  const bucketMs = Math.max(1000, Math.ceil((end - start + 1) / SUMMARY_BUCKETS / 1000) * 1000);
  const buckets = Math.floor((end - start) / bucketMs) + 1;
  const bucketStarts = Array.from({ length: buckets }, (_, index) => new Date(start + index * bucketMs).toISOString());

  const summarizeField = (field: Field): InsightSnapshotField => {
    const sums = new Array<number>(buckets).fill(0);
    const counts = new Array<number>(buckets).fill(0);
    let stats: RunningStats | undefined;
    Array.from(field.values).forEach((value, row) => {
      const time = times[row];
      if (!isFiniteNumber(value)) {
        return;
      }
      const bucket = Math.floor((time - start) / bucketMs);
      sums[bucket] += value;
      counts[bucket] += 1;
      stats ??= {
        count: 0,
        sum: 0,
        first: value,
        firstAt: time,
        last: value,
        lastAt: time,
        min: value,
        minAt: time,
        max: value,
        maxAt: time,
      };
      stats.count += 1;
      stats.sum += value;
      if (time < stats.firstAt) {
        stats.first = value;
        stats.firstAt = time;
      }
      if (time > stats.lastAt) {
        stats.last = value;
        stats.lastAt = time;
      }
      if (value < stats.min) {
        stats.min = value;
        stats.minAt = time;
      }
      if (value > stats.max) {
        stats.max = value;
        stats.maxAt = time;
      }
    });
    const iso = (time: number) => new Date(time).toISOString();
    return {
      name: getFieldDisplayName(field, frame, series),
      type: field.type,
      unit: field.config.unit,
      labels: field.labels,
      values: sums.map((sum, bucket) => (counts[bucket] ? round(sum / counts[bucket]) : null)),
      stats: stats && {
        count: stats.count,
        first: stats.first,
        firstAt: iso(stats.firstAt),
        last: stats.last,
        lastAt: iso(stats.lastAt),
        min: stats.min,
        minAt: iso(stats.minAt),
        max: stats.max,
        maxAt: iso(stats.maxAt),
        mean: round(stats.sum / stats.count),
      },
    };
  };

  return {
    name: frame.name,
    summary: { note: SUMMARY_NOTE, originalRows: frame.length, buckets, bucketSeconds: bucketMs / 1000 },
    fields: frame.fields.map((field) =>
      field.type === FieldType.time
        ? { name: getFieldDisplayName(field, frame, series), type: field.type, values: bucketStarts }
        : summarizeField(field)
    ),
  };
}

/** A variant may legitimately have no data, such as a breakdown value with no errors, but it must have loaded. */
function readyVariantSeries(title: string, variant: string, data: PanelData | undefined): DataFrame[] {
  if (!data) {
    throw new Error(
      t(
        'dashboard.insights.snapshot.variant-not-loaded',
        '“{{title}}” did not load for {{variant}} in time. Try again.',
        {
          title,
          variant,
        }
      )
    );
  }
  if (data.state !== LoadingState.Done || data.error || data.errors?.length) {
    throw new Error(
      t('dashboard.insights.snapshot.variant-error', '“{{title}}” has a query error for {{variant}}.', {
        title,
        variant,
      })
    );
  }
  return data.series;
}

const MAX_ANNOTATIONS = 30;
const MAX_ANNOTATION_TEXT = 300;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function toPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The events the sources show within the time range, such as deploys, so the answer can relate changes to them. */
function getSnapshotAnnotations(sources: InsightSourceWithData[], context: InsightContext) {
  const from = Date.parse(context.from);
  const to = Date.parse(context.to);
  // Every panel sharing a data layer carries the same annotations.
  const found = new Map<string, InsightSnapshotAnnotation & { at: number }>();
  for (const frame of sources.flatMap((source) => source.data?.annotations ?? [])) {
    const values = (name: string) => frame.fields.find((field) => field.name === name)?.values;
    const times = values('time');
    const ends = values('timeEnd');
    const titles = values('title');
    const texts = values('text');
    const tags = values('tags');
    for (let row = 0; times && row < frame.length; row++) {
      const at: unknown = times[row];
      const end: unknown = ends?.[row];
      if (!isFiniteNumber(at)) {
        continue;
      }
      const until = isFiniteNumber(end) && end > at ? end : undefined;
      if (at > to || (until ?? at) < from) {
        continue;
      }
      const text = toPlainText([titles?.[row], texts?.[row]].filter(isNonEmptyString).join(': ')).slice(
        0,
        MAX_ANNOTATION_TEXT
      );
      const rowTags: unknown = tags?.[row];
      const tagList = Array.isArray(rowTags) ? rowTags.filter(isNonEmptyString) : [];
      if (!text && !tagList.length) {
        continue;
      }
      found.set(`${at}|${until}|${text}`, {
        at,
        time: new Date(at).toISOString(),
        timeEnd: until === undefined ? undefined : new Date(until).toISOString(),
        text,
        tags: tagList.length ? tagList : undefined,
      });
    }
  }
  const sorted = [...found.values()].sort((a, b) => a.at - b.at).map(({ at, ...annotation }) => annotation);
  return { annotations: sorted.slice(-MAX_ANNOTATIONS), omitted: Math.max(0, sorted.length - MAX_ANNOTATIONS) };
}

/** Never queries a datasource or silently drops a selected source; throws a user-facing message instead. */
export function buildInsightSnapshot(
  context: InsightContext,
  selectedKeys: string[],
  available: InsightSourceWithData[],
  variants: InsightVariantsData = {}
): InsightSnapshot {
  if (!context.question.trim()) {
    throw new Error(t('dashboard.insights.snapshot.empty-question', 'This question is empty. Edit it to add text.'));
  }
  if (!selectedKeys.length) {
    throw new Error(
      t('dashboard.insights.snapshot.no-sources', 'This question has no source panels. Edit it to select at least one.')
    );
  }

  const sources = [...new Set(selectedKeys)].map((key) => {
    const source = available.find((candidate) => candidate.key === key);
    if (!source) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-unavailable',
          'A source panel is no longer on this dashboard. Edit the question to update its source panels.'
        )
      );
    }
    return { source, series: readySeries(source, context) };
  });
  // A panel with no rows is still evidence, such as no restarts, as long as another source has data.
  if (!sources.some(({ series }) => hasRows(series))) {
    throw new Error(
      sources.length === 1
        ? t(
            'dashboard.insights.snapshot.source-empty',
            '“{{title}}” has no data for this selection. Adjust the filters or time range.',
            { title: sources[0].source.title }
          )
        : t(
            'dashboard.insights.snapshot.sources-empty',
            'None of the source panels has data for this selection. Adjust the filters or time range.'
          )
    );
  }

  type Entry = (typeof sources)[number];
  const withVariant = (panels: InsightVariantPanels, variant: string): Entry[] =>
    sources
      .filter(({ source }) => panels.has(source.key))
      .map(({ source }) => ({ source, series: readyVariantSeries(source.title, variant, panels.get(source.key)) }));

  const { previousPeriod, breakdown } = variants;
  const previousEntries =
    previousPeriod &&
    withVariant(previousPeriod.panels, t('dashboard.insights.snapshot.variant-previous', 'the previous period'));
  const breakdownEntries = breakdown?.values.map((item) => {
    const label = `${breakdown.variable} = ${item.text}`;
    return {
      item,
      panels: withVariant(item.panels, label),
      previous:
        item.previousPeriod &&
        withVariant(
          item.previousPeriod,
          t('dashboard.insights.snapshot.variant-value-previous', '{{value}} over the previous period', {
            value: label,
          })
        ),
    };
  });
  const { annotations, omitted } = getSnapshotAnnotations(
    sources.map(({ source }) => source),
    context
  );

  const serialize = (summarize: boolean) => {
    const toPanels = (entries: Entry[]): InsightSnapshotPanel[] =>
      entries.map(({ source, series }) => ({
        key: source.key,
        title: source.title,
        description: source.description,
        section: source.section,
        frames: hasRows(series)
          ? series.map(
              (frame): InsightSnapshotFrame =>
                (summarize && summarizeFrame(frame, series)) || {
                  name: frame.name,
                  fields: frame.fields.map((field) => exactField(field, frame, series)),
                }
            )
          : [],
      }));
    const snapshot: InsightSnapshot = {
      ...context,
      question: context.question.trim(),
      panels: toPanels(sources),
      annotations: annotations.length ? annotations : undefined,
      omittedAnnotations: omitted || undefined,
      previousPeriod: previousPeriod &&
        previousEntries && { from: previousPeriod.from, to: previousPeriod.to, panels: toPanels(previousEntries) },
      breakdown: breakdown &&
        breakdownEntries && {
          variable: breakdown.variable,
          omittedValues: breakdown.omittedValues,
          values: breakdownEntries.map(({ item, panels, previous }) => ({
            value: item.value,
            text: item.text,
            panels: toPanels(panels),
            previousPeriod: previous && toPanels(previous),
          })),
        },
    };
    return JSON.stringify(snapshot);
  };

  let serialized = serialize(false);
  if (serialized.length > MAX_INSIGHT_INPUT_CHARACTERS) {
    serialized = serialize(true);
  }
  if (serialized.length > MAX_INSIGHT_INPUT_CHARACTERS) {
    throw new Error(
      t(
        'dashboard.insights.snapshot.too-large',
        'The selected data is too large to send, even after summarizing time series. Select fewer panels, series, or table rows, or turn off the comparison or breakdown.'
      )
    );
  }
  // Freeze nested labels and object-valued cells: live data may change while the request is in flight.
  const frozen: InsightSnapshot = JSON.parse(serialized);
  return frozen;
}

export interface InsightCapture {
  context: InsightContext;
  /** The panels the question's sources resolve to now; a tab or row expands to the panels inside it. */
  keys: string[];
  snapshot?: InsightSnapshot;
  unavailable?: string;
  /** Some sources are off screen and have not loaded yet. Asking loads them, so this does not block it. */
  unloaded?: boolean;
}

/**
 * Without `variants`, captures only what the dashboard shows now; the previous period and breakdown are
 * loaded on request, since they run extra queries.
 */
export function captureInsightSnapshot(
  dashboard: DashboardSceneLike,
  question: Pick<InsightQuestion, 'question' | 'sourcePanelKeys'>,
  variants?: InsightVariantsData
): InsightCapture {
  const context = getInsightContext(dashboard, question.question);
  const sources = getInsightSourcePanels(dashboard);
  const keys = resolveInsightSourceKeys(question.sourcePanelKeys, sources);
  try {
    const [missing] = getMissingSectionRefs(question.sourcePanelKeys, sources);
    if (missing === DASHBOARD_SOURCE_REF) {
      throw new Error(
        t('dashboard.insights.snapshot.dashboard-empty', 'This dashboard has no panels with queries to use as sources.')
      );
    }
    if (missing !== undefined) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.section-unavailable',
          '“{{title}}” is no longer on this dashboard or has no panels with queries. Edit the question to update its sources.',
          { title: getMissingRefLabel(missing) }
        )
      );
    }
    const available = sources
      .filter((source) => keys.includes(source.key))
      .map((source) => ({
        key: source.key,
        title: source.title,
        description: source.description,
        section: getPanelLocation(source) || undefined,
        active: source.panel.isActive,
        data: getInsightSourceData(source.panel),
      }));
    return { context, keys, snapshot: buildInsightSnapshot(context, keys, available, variants) };
  } catch (error) {
    return {
      context,
      keys,
      unavailable: error instanceof Error ? error.message : String(error),
      unloaded: error instanceof InsightSourceNotLoadedError,
    };
  }
}
