import * as z from 'zod';

import {
  MAX_CAPTURE_LENGTH,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_HEIGHT_HINT_PX,
  MAX_HREF_LENGTH,
  RENDER_PROTOCOL_VERSION,
} from './constants';

export type SerializedValue = string | number | boolean | null;

/**
 * The FieldConfig keys the frame receives, with the FieldConfig shape. links, actions and custom are
 * left out; named colors are resolved to CSS colors and -Infinity threshold steps become null.
 */
export interface SerializedFieldConfig {
  displayName?: string;
  displayNameFromDS?: string;
  description?: string;
  unit?: string;
  decimals?: number | null;
  min?: number | null;
  max?: number | null;
  interval?: number | null;
  noValue?: string;
  mappings?: unknown[];
  thresholds?: { mode: string; steps: Array<{ value: number | null; color: string }> };
  color?: { mode: string; fixedColor?: string; seriesBy?: string };
}

/** DisplayValue with NaN numeric values as null. */
export interface SerializedDisplayValue {
  text: string;
  numeric: number | null;
  prefix?: string;
  suffix?: string;
  color?: string;
  percent?: number;
}

/** A Field without its functions (display, getLinks). */
export interface SerializedField {
  name: string;
  /** A FieldType value. */
  type: string;
  /** Time values are epoch ms, NaN and Infinity become null, objects become (cut) JSON strings. */
  values: SerializedValue[];
  labels?: Record<string, string>;
  config: SerializedFieldConfig;
  state: {
    displayName: string;
    /** Addition: field.display(lastNotNull), computed on the host because display() cannot cross the frame. */
    lastNotNullDisplay?: SerializedDisplayValue;
  };
}

/** A DataFrame; meta only carries the dashboard source panel. */
export interface SerializedFrame {
  name?: string;
  refId?: string;
  meta?: { custom: { dashboardSourcePanelId: number; dashboardSourcePanelTitle?: string } };
  fields: SerializedField[];
  length: number;
}

export type SerializedLoadingState = 'NotStarted' | 'Loading' | 'Streaming' | 'Done' | 'Error' | 'PartialResult';

/** TimeRange with epoch ms instead of DateTime, which cannot cross the frame. */
export interface SerializedTimeRange {
  from: number;
  to: number;
  raw: { from: string; to: string };
}

/** PanelData without request and the deprecated error. */
export interface SerializedPanelData {
  state: SerializedLoadingState;
  series: SerializedFrame[];
  timeRange: SerializedTimeRange;
  errors: Array<{ message: string; refId?: string }>;
}

export interface SerializedFieldConfigSource {
  defaults: SerializedFieldConfig;
  overrides: Array<{ matcher: { id: string; options?: unknown }; properties: Array<{ id: string; value?: unknown }> }>;
}

/** The theme as CSS custom properties; the frame sets them on :root. Not part of ctx. */
export interface ThemeVariables {
  colorScheme: 'light' | 'dark';
  vars: Record<string, string>;
}

export interface RenderLocation {
  pathname: string;
  search: string;
}

export interface RenderSize {
  width: number;
  height: number;
}

/** Everything a draw receives. All of it but theme becomes ctx, with the PanelProps names. */
export interface RenderInput {
  id: number;
  title: string;
  data: SerializedPanelData;
  timeRange: SerializedTimeRange;
  timeZone: string;
  options: Record<string, unknown>;
  fieldConfig: SerializedFieldConfigSource;
  width: number;
  height: number;
  transparent: boolean;
  fitContent: boolean;
  location: RenderLocation;
  theme: ThemeVariables;
}

/** Host -> frame messages, sent on the transferred port. seq is shared by render and resize. */
export type HostMessage =
  | { type: 'render'; seq: number; input: RenderInput }
  | { type: 'resize'; seq: number; size: RenderSize }
  | { type: 'ping'; id: number }
  | { type: 'capture'; id: number }
  | { type: 'pause' }
  | { type: 'resume' };

export interface RenderInitMessage {
  type: string;
  version: typeof RENDER_PROTOCOL_VERSION;
}

/** A capture is a PNG data URL and nothing else, so the host can show it as an image. */
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]*={0,2}$/;

export const frameErrorKindSchema = z.enum(['startup', 'runtime', 'csp', 'output-limit']);

/**
 * Frame -> host messages. Anything that does not parse is a fatal protocol error on the host. The
 * schemas are strict so a message cannot carry unbounded extra payload past validation.
 */
export const frameMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ready'), version: z.literal(RENDER_PROTOCOL_VERSION) }),
  z.strictObject({
    type: z.literal('render-complete'),
    seq: z.number().int().min(0),
    durationMs: z.number().finite().min(0),
    nodeCount: z.number().int().min(0),
  }),
  z.strictObject({ type: z.literal('height'), height: z.number().finite().min(0).max(MAX_HEIGHT_HINT_PX) }),
  z.strictObject({
    type: z.literal('error'),
    kind: frameErrorKindSchema,
    message: z.string().max(MAX_DIAGNOSTIC_LENGTH),
    seq: z.number().int().optional(),
  }),
  z.strictObject({ type: z.literal('link'), href: z.string().min(1).max(MAX_HREF_LENGTH) }),
  z.strictObject({ type: z.literal('pong'), id: z.number().int() }),
  z.strictObject({
    type: z.literal('capture'),
    id: z.number().int(),
    image: z.string().max(MAX_CAPTURE_LENGTH).regex(PNG_DATA_URL).optional(),
    error: z.string().max(MAX_DIAGNOSTIC_LENGTH).optional(),
  }),
]);

export type FrameMessage = z.infer<typeof frameMessageSchema>;
export type FrameErrorKind = z.infer<typeof frameErrorKindSchema>;

export function parseFrameMessage(value: unknown): FrameMessage | null {
  const parsed = frameMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A short English description of why a frame message was rejected, for diagnostics. */
export function describeInvalidFrameMessage(value: unknown): string {
  const parsed = frameMessageSchema.safeParse(value);
  if (parsed.success) {
    return '';
  }
  const type = value && typeof value === 'object' && 'type' in value ? String(value.type).slice(0, 64) : 'unknown';
  const issues = parsed.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return `The panel frame sent an invalid "${type}" message (${issues}).`.slice(0, MAX_DIAGNOSTIC_LENGTH);
}
