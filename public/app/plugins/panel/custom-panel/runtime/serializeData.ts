import {
  type DataFrame,
  type DataQueryError,
  type DisplayValue,
  type Field,
  type FieldConfig,
  type FieldConfigSource,
  FieldType,
  getFieldDisplayName,
  getTimeZone,
  type GrafanaTheme2,
  type PanelData,
  type TimeRange,
  type TimeZone,
} from '@grafana/data';

import {
  DASHBOARD_SOURCE_PANEL_ID_META_KEY,
  DASHBOARD_SOURCE_PANEL_TITLE_META_KEY,
  DASHBOARD_SOURCE_REF_ID_META_KEY,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_STRING_CELL_LENGTH,
  MAX_TRANSFER_BYTES,
  MAX_TRANSFER_CELLS,
  MAX_TRANSFER_FRAMES,
} from './constants';
import {
  type RenderInput,
  type RenderLocation,
  type SerializedDisplayValue,
  type SerializedField,
  type SerializedFieldConfig,
  type SerializedFieldConfigSource,
  type SerializedFrame,
  type SerializedLoadingState,
  type SerializedPanelData,
  type SerializedTimeRange,
  type SerializedValue,
} from './protocol';
import { serializeTheme } from './theme';

const MAX_SOURCE_TITLE_LENGTH = 200;
const LOADING_STATES: SerializedLoadingState[] = [
  'NotStarted',
  'Loading',
  'Streaming',
  'Done',
  'Error',
  'PartialResult',
];

export type SerializeResult =
  | { ok: true; data: SerializedPanelData; cells: number }
  | { ok: false; reason: 'too-many-frames' | 'too-many-cells'; actual: number; limit: number };

export type BuildInputResult =
  | { ok: true; input: RenderInput; bytes: number }
  | { ok: false; reason: 'too-many-frames' | 'too-many-cells' | 'too-large'; actual: number; limit: number };

/** Converts panel data to plain JSON for the frame. Over a limit it refuses instead of truncating. */
export function serializePanelData(data: PanelData, theme: GrafanaTheme2): SerializeResult {
  const series = data.series ?? [];
  if (series.length > MAX_TRANSFER_FRAMES) {
    return { ok: false, reason: 'too-many-frames', actual: series.length, limit: MAX_TRANSFER_FRAMES };
  }
  let cells = 0;
  for (const frame of series) {
    for (const field of frame.fields) {
      cells += field.values.length;
    }
  }
  if (cells > MAX_TRANSFER_CELLS) {
    return { ok: false, reason: 'too-many-cells', actual: cells, limit: MAX_TRANSFER_CELLS };
  }
  const state = String(data.state);
  return {
    ok: true,
    cells,
    data: {
      state: isLoadingState(state) ? state : 'NotStarted',
      series: series.map((frame) => serializeFrame(frame, series, theme)),
      timeRange: serializeTimeRange(data.timeRange),
      errors: readErrors(data),
    },
  };
}

/** The full snapshot sent with every render. bytes is the JSON length that the limit is checked against. */
export function buildRenderInput(params: {
  id: number;
  title: string;
  data: PanelData;
  timeRange: TimeRange;
  timeZone: TimeZone;
  options: object;
  fieldConfig: FieldConfigSource;
  theme: GrafanaTheme2;
  width: number;
  height: number;
  transparent: boolean;
  fitContent: boolean;
  location: RenderLocation;
}): BuildInputResult {
  const serialized = serializePanelData(params.data, params.theme);
  if (!serialized.ok) {
    return serialized;
  }
  const input: RenderInput = {
    id: params.id,
    title: params.title,
    data: serialized.data,
    timeRange: serializeTimeRange(params.timeRange),
    timeZone: resolveTimeZone(params.timeZone),
    options: serializeOptions(params.options),
    fieldConfig: serializeFieldConfigSource(params.fieldConfig, params.theme),
    width: toSize(params.width),
    height: toSize(params.height),
    transparent: params.transparent,
    fitContent: params.fitContent,
    location: { pathname: params.location.pathname, search: params.location.search },
    theme: serializeTheme(params.theme),
  };
  const bytes = JSON.stringify(input).length;
  if (bytes > MAX_TRANSFER_BYTES) {
    return { ok: false, reason: 'too-large', actual: bytes, limit: MAX_TRANSFER_BYTES };
  }
  return { ok: true, input, bytes };
}

export type RenderInputBuilder = typeof buildRenderInput;

/**
 * One builder per drawing API version, so a panel pinned to a version keeps getting that ctx after
 * Grafana upgrades. A breaking change adds a builder for the next version and keeps this one.
 */
const RENDER_INPUT_BUILDERS: ReadonlyMap<number, RenderInputBuilder> = new Map([[1, buildRenderInput]]);

export const SUPPORTED_API_VERSIONS: readonly number[] = [...RENDER_INPUT_BUILDERS.keys()];

/** The builder for a panel's apiVersion, or undefined for a version this Grafana does not know. */
export function getRenderInputBuilder(apiVersion: unknown): RenderInputBuilder | undefined {
  return typeof apiVersion === 'number' ? RENDER_INPUT_BUILDERS.get(apiVersion) : undefined;
}

/** The frame formats with Intl, which needs a concrete IANA zone, never 'browser'. */
export function resolveTimeZone(timeZone: TimeZone): string {
  const resolved = getTimeZone({ timeZone });
  if (!resolved || resolved === 'browser') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  if (resolved.toLowerCase() === 'utc') {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: resolved });
    return resolved;
  } catch {
    return 'UTC';
  }
}

function serializeTimeRange(timeRange: TimeRange): SerializedTimeRange {
  return {
    from: timeRange.from.valueOf(),
    to: timeRange.to.valueOf(),
    raw: { from: rawTimeText(timeRange.raw.from), to: rawTimeText(timeRange.raw.to) },
  };
}

function serializeFrame(frame: DataFrame, allFrames: DataFrame[], theme: GrafanaTheme2): SerializedFrame {
  const serialized: SerializedFrame = {
    fields: frame.fields.map((field) => serializeField(field, frame, allFrames, theme)),
    length: frame.length,
  };
  if (frame.name !== undefined) {
    serialized.name = frame.name;
  }
  if (frame.refId !== undefined) {
    serialized.refId = frame.refId;
  }
  const meta = readSourceMeta(frame);
  if (meta) {
    serialized.meta = meta;
  }
  return serialized;
}

/** Only the dashboard source panel crosses: other meta (queries, stats, notices) stays on the host. */
function readSourceMeta(frame: DataFrame): SerializedFrame['meta'] {
  const custom: unknown = frame.meta?.custom;
  if (!custom || typeof custom !== 'object') {
    return undefined;
  }
  const panelId: unknown = Reflect.get(custom, DASHBOARD_SOURCE_PANEL_ID_META_KEY);
  if (typeof panelId !== 'number' || !Number.isInteger(panelId)) {
    return undefined;
  }
  const title: unknown = Reflect.get(custom, DASHBOARD_SOURCE_PANEL_TITLE_META_KEY);
  const refId: unknown = Reflect.get(custom, DASHBOARD_SOURCE_REF_ID_META_KEY);
  return {
    custom: {
      dashboardSourcePanelId: panelId,
      ...(typeof title === 'string' && { dashboardSourcePanelTitle: title.slice(0, MAX_SOURCE_TITLE_LENGTH) }),
      ...(typeof refId === 'string' && { dashboardSourceRefId: refId.slice(0, MAX_SOURCE_TITLE_LENGTH) }),
    },
  };
}

function serializeField(field: Field, frame: DataFrame, allFrames: DataFrame[], theme: GrafanaTheme2): SerializedField {
  const isTime = field.type === FieldType.time;
  const values: SerializedValue[] = new Array(field.values.length);
  let lastIndex = -1;
  for (let i = 0; i < field.values.length; i++) {
    const value = isTime ? toTimeValue(field.values[i]) : toCellValue(field.values[i]);
    values[i] = value;
    if (value !== null) {
      lastIndex = i;
    }
  }
  const serialized: SerializedField = {
    name: field.name,
    type: field.type,
    values,
    config: serializeFieldConfig(field.config, theme),
    state: { displayName: field.state?.displayName ?? getFieldDisplayName(field, frame, allFrames) },
  };
  if (field.labels && Object.keys(field.labels).length > 0) {
    serialized.labels = { ...field.labels };
  }
  if (field.display && lastIndex >= 0) {
    serialized.state.lastNotNullDisplay = serializeDisplayValue(field.display(field.values[lastIndex]), isTime);
  }
  return serialized;
}

/** A time has no place on a min/max scale or a threshold, so it keeps only its text. */
function serializeDisplayValue(display: DisplayValue, isTime: boolean): SerializedDisplayValue {
  const serialized: SerializedDisplayValue = {
    text: display.text,
    numeric: Number.isFinite(display.numeric) ? display.numeric : null,
  };
  if (display.prefix) {
    serialized.prefix = display.prefix;
  }
  if (display.suffix) {
    serialized.suffix = display.suffix;
  }
  if (isTime) {
    return serialized;
  }
  if (typeof display.color === 'string') {
    serialized.color = display.color;
  }
  if (typeof display.percent === 'number' && Number.isFinite(display.percent)) {
    serialized.percent = display.percent;
  }
  return serialized;
}

const FIELD_CONFIG_STRINGS = ['displayName', 'displayNameFromDS', 'description', 'unit', 'noValue'] as const;
const FIELD_CONFIG_NUMBERS = ['decimals', 'min', 'max', 'interval'] as const;

/**
 * Named colors in a value, range, regex or special mapping become CSS colors, like thresholds.
 * Value mappings keep their results in options[value]; the others in options.result.
 */
function resolveMappingColors(mapping: unknown, theme: GrafanaTheme2): unknown {
  if (!isRecord(mapping) || !isRecord(mapping.options)) {
    return mapping;
  }
  const resolve = (result: unknown): unknown =>
    isRecord(result) && typeof result.color === 'string'
      ? { ...result, color: theme.visualization.getColorByName(result.color) }
      : result;
  const options = mapping.options;
  if (mapping.type === 'value') {
    return {
      ...mapping,
      options: Object.fromEntries(Object.entries(options).map(([key, result]) => [key, resolve(result)])),
    };
  }
  return 'result' in options ? { ...mapping, options: { ...options, result: resolve(options.result) } } : mapping;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The display keys of a FieldConfig. links and actions are left out because the frame can only
 * follow allowlisted links, and custom because it belongs to the panel plugin that set it.
 */
function serializeFieldConfig(config: FieldConfig, theme: GrafanaTheme2): SerializedFieldConfig {
  const serialized: SerializedFieldConfig = {};
  for (const key of FIELD_CONFIG_STRINGS) {
    const value = config[key];
    if (typeof value === 'string') {
      serialized[key] = cut(value);
    }
  }
  for (const key of FIELD_CONFIG_NUMBERS) {
    const value = config[key];
    if (value === null || (typeof value === 'number' && Number.isFinite(value))) {
      serialized[key] = value;
    }
  }
  if (Array.isArray(config.mappings) && config.mappings.length > 0) {
    const mappings = toJson(config.mappings);
    if (Array.isArray(mappings)) {
      serialized.mappings = mappings.map((mapping) => resolveMappingColors(mapping, theme));
    }
  }
  const { thresholds, color } = config;
  if (thresholds && Array.isArray(thresholds.steps)) {
    serialized.thresholds = {
      mode: String(thresholds.mode),
      steps: thresholds.steps.map((step) => ({
        value: Number.isFinite(step.value) ? step.value : null,
        color: theme.visualization.getColorByName(step.color),
      })),
    };
  }
  if (color && typeof color.mode === 'string') {
    serialized.color = { mode: color.mode };
    if (typeof color.fixedColor === 'string') {
      serialized.color.fixedColor = theme.visualization.getColorByName(color.fixedColor);
    }
    if (typeof color.seriesBy === 'string') {
      serialized.color.seriesBy = color.seriesBy;
    }
  }
  return serialized;
}

const OMITTED_OVERRIDE_PROPERTIES = new Set(['links', 'actions']);

function serializeFieldConfigSource(source: FieldConfigSource, theme: GrafanaTheme2): SerializedFieldConfigSource {
  const overrides = (source?.overrides ?? []).map((override) => ({
    matcher: { id: String(override.matcher?.id), options: toJson(override.matcher?.options) },
    properties: (override.properties ?? [])
      .filter((property) => !OMITTED_OVERRIDE_PROPERTIES.has(property.id) && !property.id.startsWith('custom.'))
      .map((property) => ({ id: property.id, value: toJson(property.value) })),
  }));
  return { defaults: serializeFieldConfig(source?.defaults ?? {}, theme), overrides };
}

/** Panel options without the drawing code, which the frame already runs, and its apiVersion (panel.apiVersion). */
function serializeOptions(options: object): Record<string, unknown> {
  const copy = toJson(options);
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
    return {};
  }
  const result: Record<string, unknown> = { ...copy };
  delete result.code;
  delete result.apiVersion;
  return result;
}

/** A plain JSON copy: functions, undefined and cycles never reach the frame. */
function toJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  try {
    const text = JSON.stringify(value);
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toTimeValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && typeof value.valueOf === 'function') {
    const parsed = Number(value.valueOf());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toCellValue(value: unknown): SerializedValue {
  switch (typeof value) {
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'boolean':
      return value;
    case 'string':
      return cut(value);
    case 'bigint':
      return cut(value.toString());
    case 'object':
      if (value === null) {
        return null;
      }
      return cut(stringifyObject(value));
    default:
      return null;
  }
}

function stringifyObject(value: object): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function cut(value: string): string {
  return value.length > MAX_STRING_CELL_LENGTH ? `${value.slice(0, MAX_STRING_CELL_LENGTH)}…` : value;
}

function readErrors(data: PanelData): SerializedPanelData['errors'] {
  const errors: DataQueryError[] = data.errors ?? (data.error ? [data.error] : []);
  return errors.map((error) => {
    const message = (error.message ?? error.data?.message ?? error.data?.error ?? 'Query error').slice(
      0,
      MAX_DIAGNOSTIC_LENGTH
    );
    return error.refId ? { message, refId: error.refId } : { message };
  });
}

function rawTimeText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
    return String(value.toISOString());
  }
  return String(value);
}

function toSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isLoadingState(value: string): value is SerializedLoadingState {
  return LOADING_STATES.some((state) => state === value);
}
