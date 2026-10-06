import {
  type DataFrame,
  type DataQueryError,
  type Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  getTimeZone,
  type GrafanaTheme2,
  type InterpolateFunction,
  type PanelData,
  ThresholdsMode,
  type TimeRange,
  type TimeZone,
} from '@grafana/data';

import {
  DASHBOARD_SOURCE_PANEL_ID_META_KEY,
  DASHBOARD_SOURCE_PANEL_TITLE_META_KEY,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_STRING_CELL_LENGTH,
  MAX_TRANSFER_BYTES,
  MAX_TRANSFER_CELLS,
  MAX_TRANSFER_FRAMES,
} from './constants';
import {
  type RenderInput,
  type SerializedField,
  type SerializedFrame,
  type SerializedLoadingState,
  type SerializedPanelData,
  type SerializedValue,
  type VariableSnapshot,
} from './protocol';
import { serializeTheme } from './theme';
import { snapshotVariables } from './variables';

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
      errors: readErrors(data),
    },
  };
}

/** The full snapshot sent with every render. bytes is the JSON length that the limit is checked against. */
export function buildRenderInput(params: {
  data: PanelData;
  timeRange: TimeRange;
  timeZone: TimeZone;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
  width: number;
  height: number;
  isRenderTarget: boolean;
  /** A snapshot the caller already took, so the variables are resolved once per render. */
  variables?: VariableSnapshot;
}): BuildInputResult {
  const serialized = serializePanelData(params.data, params.theme);
  if (!serialized.ok) {
    return serialized;
  }
  const { timeRange } = params;
  const input: RenderInput = {
    data: serialized.data,
    timeRange: {
      from: timeRange.from.valueOf(),
      to: timeRange.to.valueOf(),
      raw: { from: rawTimeText(timeRange.raw.from), to: rawTimeText(timeRange.raw.to) },
    },
    timeZone: resolveTimeZone(params.timeZone),
    variables: params.variables ?? snapshotVariables(params.replaceVariables),
    theme: serializeTheme(params.theme),
    size: { width: toSize(params.width), height: toSize(params.height) },
    isRenderTarget: params.isRenderTarget,
  };
  const bytes = JSON.stringify(input).length;
  if (bytes > MAX_TRANSFER_BYTES) {
    return { ok: false, reason: 'too-large', actual: bytes, limit: MAX_TRANSFER_BYTES };
  }
  return { ok: true, input, bytes };
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

function serializeFrame(frame: DataFrame, allFrames: DataFrame[], theme: GrafanaTheme2): SerializedFrame {
  const serialized: SerializedFrame = {
    length: frame.length,
    fields: frame.fields.map((field) => serializeField(field, frame, allFrames, theme)),
  };
  if (frame.refId !== undefined) {
    serialized.refId = frame.refId;
  }
  if (frame.name !== undefined) {
    serialized.name = frame.name;
  }
  const source = readSource(frame);
  if (source) {
    serialized.source = source;
  }
  return serialized;
}

function readSource(frame: DataFrame): SerializedFrame['source'] {
  const custom: unknown = frame.meta?.custom;
  if (!custom || typeof custom !== 'object') {
    return undefined;
  }
  const panelId: unknown = Reflect.get(custom, DASHBOARD_SOURCE_PANEL_ID_META_KEY);
  if (typeof panelId !== 'number' || !Number.isInteger(panelId)) {
    return undefined;
  }
  const title: unknown = Reflect.get(custom, DASHBOARD_SOURCE_PANEL_TITLE_META_KEY);
  return typeof title === 'string' ? { panelId, title: title.slice(0, MAX_SOURCE_TITLE_LENGTH) } : { panelId };
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
    displayName: field.state?.displayName ?? getFieldDisplayName(field, frame, allFrames),
    type: field.type,
    values,
  };
  if (field.config.unit) {
    serialized.unit = field.config.unit;
  }
  if (field.labels && Object.keys(field.labels).length > 0) {
    serialized.labels = { ...field.labels };
  }
  if (field.display && lastIndex >= 0) {
    const display = field.display(field.values[lastIndex]);
    serialized.lastDisplay = formattedValueToString(display);
    if (typeof display.color === 'string') {
      serialized.lastColor = display.color;
    }
  }
  const thresholds = field.config.thresholds;
  if (thresholds?.mode === ThresholdsMode.Absolute && thresholds.steps.length > 0) {
    serialized.thresholds = thresholds.steps.map((step) => ({
      value: Number.isFinite(step.value) ? step.value : null,
      color: theme.visualization.getColorByName(step.color),
    }));
  }
  return serialized;
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

function readErrors(data: PanelData): string[] {
  const errors: DataQueryError[] = data.errors ?? (data.error ? [data.error] : []);
  return errors.map((error) => {
    const message = error.message ?? error.data?.message ?? error.data?.error ?? 'Query error';
    const text = error.refId ? `${error.refId}: ${message}` : message;
    return text.slice(0, MAX_DIAGNOSTIC_LENGTH);
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
