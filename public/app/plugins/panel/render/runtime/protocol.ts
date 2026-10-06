import * as z from 'zod';

import { MAX_DIAGNOSTIC_LENGTH, MAX_HEIGHT_HINT_PX, MAX_HREF_LENGTH, RENDER_PROTOCOL_VERSION } from './constants';

export type SerializedValue = string | number | boolean | null;

export interface SerializedField {
  name: string;
  displayName: string;
  /** A FieldType value. */
  type: string;
  unit?: string;
  labels?: Record<string, string>;
  /** Time values are epoch ms, NaN and Infinity become null, objects become (cut) JSON strings. */
  values: SerializedValue[];
  /** formattedValueToString(field.display(lastNonNull)), computed on the host. */
  lastDisplay?: string;
  lastColor?: string;
  /** Absolute threshold steps with resolved colors; the base step has value null. */
  thresholds?: Array<{ value: number | null; color: string }>;
}

export interface SerializedFrame {
  refId?: string;
  name?: string;
  length: number;
  /** The panel a "-- Dashboard --" frame came from. */
  source?: { panelId: number; title?: string };
  fields: SerializedField[];
}

export type SerializedLoadingState = 'NotStarted' | 'Loading' | 'Streaming' | 'Done' | 'Error' | 'PartialResult';

export interface SerializedPanelData {
  state: SerializedLoadingState;
  series: SerializedFrame[];
  errors: string[];
}

export interface ThemeSnapshot {
  mode: 'light' | 'dark';
  colors: {
    text: { primary: string; secondary: string; disabled: string; link: string };
    background: { canvas: string; primary: string; secondary: string };
    border: { weak: string; medium: string; strong: string };
    primary: { main: string; text: string; contrastText: string };
    success: { main: string; text: string };
    warning: { main: string; text: string };
    error: { main: string; text: string };
    info: { main: string; text: string };
  };
  palette: string[];
  typography: { fontFamily: string; fontFamilyMonospace: string; fontSize: number; bodySmallFontSize: string };
  spacingGridSize: number;
  borderRadius: string;
}

export type VariableSnapshot = Record<string, { value: string | string[]; text: string | string[] }>;

export interface RenderSize {
  width: number;
  height: number;
}

export interface RenderInput {
  data: SerializedPanelData;
  timeRange: { from: number; to: number; raw: { from: string; to: string } };
  timeZone: string;
  variables: VariableSnapshot;
  theme: ThemeSnapshot;
  size: RenderSize;
  isRenderTarget: boolean;
}

/** Host -> frame messages, sent on the transferred port. seq is shared by render and resize. */
export type HostMessage =
  | { type: 'render'; seq: number; input: RenderInput }
  | { type: 'resize'; seq: number; size: RenderSize }
  | { type: 'ping'; id: number }
  | { type: 'pause' }
  | { type: 'resume' };

export interface RenderInitMessage {
  type: string;
  version: typeof RENDER_PROTOCOL_VERSION;
}

export const frameErrorKindSchema = z.enum(['startup', 'runtime', 'csp', 'output-limit']);

/** Frame -> host messages. Anything that does not parse is a fatal protocol error on the host. */
export const frameMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), version: z.literal(RENDER_PROTOCOL_VERSION) }),
  z.object({
    type: z.literal('render-complete'),
    seq: z.number().int().min(0),
    durationMs: z.number().finite().min(0),
    nodeCount: z.number().int().min(0),
  }),
  z.object({ type: z.literal('height'), height: z.number().finite().min(0).max(MAX_HEIGHT_HINT_PX) }),
  z.object({
    type: z.literal('error'),
    kind: frameErrorKindSchema,
    message: z.string().max(MAX_DIAGNOSTIC_LENGTH),
    seq: z.number().int().optional(),
  }),
  z.object({ type: z.literal('link'), href: z.string().min(1).max(MAX_HREF_LENGTH) }),
  z.object({ type: z.literal('pong'), id: z.number().int() }),
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
