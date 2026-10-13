import { type DataFrame, getFieldDisplayName, LoadingState, type PanelData } from '@grafana/data';
import {
  type CapturedAnnotation,
  type CapturedFrame,
  type CapturedPanel,
  type DashboardPanelCapture,
  type DashboardPanelCaptureRequest,
  type DashboardSectionInfo,
} from '@grafana/runtime';
import { MultiValueVariable, sceneGraph, type VariableValueOption } from '@grafana/scenes';

import { type DashboardSceneLike } from '../scene/types/dashboard';

import { expandSourceRefs, resolveSourceRefs, sectionRef } from './sections';
import { getPanelData, getSectionLabel, getSourcePanels, loadPanels, type SourcePanel } from './sources';
import { loadVariantData, type PanelVariant, usesDashboardQueries, usesVariable } from './variants';

type PanelResult = Pick<CapturedPanel, 'status' | 'error' | 'frames'>;

export function toSectionInfo(source: SourcePanel): DashboardSectionInfo[] {
  return source.sections.map((section, index) => ({
    kind: section.kind,
    title: section.title,
    label: getSectionLabel(section),
    ref: sectionRef(source.sections.slice(0, index + 1).map(({ title }) => title)),
  }));
}

export function getVariableValues(dashboard: DashboardSceneLike): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of sceneGraph.getVariables(dashboard)?.state.variables ?? []) {
    const name = variable.state.name;
    values[name] = sceneGraph.interpolate(dashboard, `\${${name}}`);
  }
  return values;
}

function toFrames(series: DataFrame[]): CapturedFrame[] {
  return series.map((frame) => ({
    name: frame.name,
    fields: frame.fields.map((field) => ({
      name: getFieldDisplayName(field, frame, series),
      type: field.type,
      unit: field.config.unit,
      labels: field.labels,
      values: Array.from(field.values),
    })),
  }));
}

function getErrorMessage(data: PanelData): string | undefined {
  return data.error?.message ?? data.errors?.find((error) => error.message)?.message;
}

function hasErrors(data: PanelData): boolean {
  return data.state === LoadingState.Error || Boolean(data.error || data.errors?.length);
}

/** What the dashboard shows for the panel now. */
function readLive(source: SourcePanel, from: string, to: string): PanelResult {
  const data = getPanelData(source.panel);
  if (!data || data.state === LoadingState.NotStarted) {
    return { status: 'not-loaded', frames: [] };
  }
  if (data.state === LoadingState.Loading || data.state === LoadingState.Streaming) {
    return { status: 'loading', frames: [] };
  }
  if (hasErrors(data)) {
    return { status: 'error', error: getErrorMessage(data), frames: [] };
  }
  if (data.timeRange && (data.timeRange.from.toISOString() !== from || data.timeRange.to.toISOString() !== to)) {
    // An inactive panel keeps the data of the last range it ran for; a capture with `load` refreshes it.
    return { status: source.panel.isActive ? 'time-range-mismatch' : 'not-loaded', frames: [] };
  }
  return { status: 'done', frames: toFrames(data.series) };
}

async function readVariant(source: SourcePanel, variant: PanelVariant, signal: AbortSignal): Promise<PanelResult> {
  if (usesDashboardQueries(source.panel)) {
    return { status: 'reuses-dashboard-query', frames: [] };
  }
  if (variant.variable && !usesVariable(source.panel, variant.variable.name)) {
    return { status: 'independent', frames: [] };
  }
  const data = await loadVariantData(source.panel, variant, signal);
  if (!data) {
    return { status: 'not-loaded', frames: [] };
  }
  if (hasErrors(data)) {
    return { status: 'error', error: getErrorMessage(data), frames: [] };
  }
  return { status: 'done', frames: toFrames(data.series) };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Every panel sharing a data layer carries the same annotations, so they are merged. */
function readAnnotations(datas: PanelData[], from: number, to: number): CapturedAnnotation[] {
  const found = new Map<string, CapturedAnnotation & { at: number }>();
  for (const frame of datas.flatMap((data) => data.annotations ?? [])) {
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
      const title: unknown = titles?.[row];
      const text: unknown = texts?.[row];
      const rowTags: unknown = tags?.[row];
      const tagList = Array.isArray(rowTags) ? rowTags.filter(isNonEmptyString) : [];
      const annotation = {
        at,
        time: new Date(at).toISOString(),
        timeEnd: until === undefined ? undefined : new Date(until).toISOString(),
        title: isNonEmptyString(title) ? title : undefined,
        text: isNonEmptyString(text) ? text : undefined,
        tags: tagList.length ? tagList : undefined,
      };
      if (annotation.title || annotation.text || annotation.tags) {
        found.set(`${at}|${until}|${annotation.title}|${annotation.text}`, annotation);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.at - b.at).map(({ at, ...annotation }) => annotation);
}

function resolveVariable(dashboard: DashboardSceneLike, { name, value }: { name: string; value: string }) {
  const variable = sceneGraph.lookupVariable(name, dashboard);
  const option =
    variable instanceof MultiValueVariable
      ? variable.state.options.find((candidate: VariableValueOption) => String(candidate.value) === value)
      : undefined;
  return { name, value, text: option?.label ?? value };
}

export async function capturePanels(
  dashboard: DashboardSceneLike,
  request: DashboardPanelCaptureRequest
): Promise<DashboardPanelCapture> {
  const signal = request.signal ?? new AbortController().signal;
  const live = sceneGraph.getTimeRange(dashboard).state.value;
  const from = request.timeRange?.from ?? live.from.toISOString();
  const to = request.timeRange?.to ?? live.to.toISOString();
  const sources = getSourcePanels(dashboard);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const keys = expandSourceRefs(request.sources, sources);
  const missingRefs = resolveSourceRefs(request.sources, sources).unavailable.filter(
    (source) => source.sectionPath !== undefined
  );
  const variable = request.variable && resolveVariable(dashboard, request.variable);
  const variant: PanelVariant | undefined =
    request.timeRange || variable ? { timeRange: request.timeRange, variable } : undefined;

  if (!variant && request.load) {
    await loadPanels(
      keys.flatMap((key) => byKey.get(key)?.panel ?? []),
      signal
    );
  }

  const panels = await Promise.all(
    keys.map(async (key): Promise<CapturedPanel> => {
      const source = byKey.get(key);
      if (!source) {
        return { key, title: key, description: '', sections: [], status: 'missing', frames: [] };
      }
      const result = variant ? await readVariant(source, variant, signal) : readLive(source, from, to);
      return { key, title: source.title, description: source.description, sections: toSectionInfo(source), ...result };
    })
  );

  const capturedData = panels.flatMap((panel) => {
    const source = panel.status === 'done' ? byKey.get(panel.key) : undefined;
    return (source && getPanelData(source.panel)) ?? [];
  });
  const variables = getVariableValues(dashboard);
  return {
    timeRange: { from, to },
    variables: variable ? { ...variables, [variable.name]: variable.value } : variables,
    missingRefs,
    panels,
    annotations: variant ? [] : readAnnotations(capturedData, Date.parse(from), Date.parse(to)),
  };
}
