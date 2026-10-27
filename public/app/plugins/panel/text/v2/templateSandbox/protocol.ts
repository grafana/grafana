export const PROTOCOL = 'grafana-text-template-v1';
export const MAX_TEMPLATE_CHARS = 1_000_000;
export const MAX_OUTPUT_CHARS = 1_000_000;
export const MAX_MESSAGE_CHARS = 8_000_000;
export const MAX_ERROR_CHARS = 1000;
export const MAX_HELPERS = 4096;

export interface TemplateInput {
  template: string;
  data: Record<string, unknown>;
  trackRows: boolean;
}
export interface TemplateResult {
  content: string;
  readRows: boolean;
  compilations?: number;
}
export interface HelperCall {
  name: 'date' | 'variable' | 'variableValue';
  args: unknown[];
}
export type HelperValue = string | string[];
export type HelperValues = Array<[string, HelperValue]>;

export interface RenderRequest extends TemplateInput {
  protocol: typeof PROTOCOL;
  channel: string;
  type: 'render';
  id: number;
  helpers: HelperValues;
}

export type Notification =
  | { type: 'ready' }
  | ({ type: 'result'; id: number } & TemplateResult)
  | { type: 'helper'; id: number; call: HelperCall }
  | { type: 'error'; id: number; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function isHelperValue(value: unknown): value is HelperValue {
  return typeof value === 'string'
    ? value.length <= MAX_OUTPUT_CHARS
    : Array.isArray(value) &&
        value.length <= MAX_HELPERS &&
        value.every((item) => typeof item === 'string') &&
        JSON.stringify(value).length <= MAX_OUTPUT_CHARS;
}
export function isHelperCall(value: unknown): value is HelperCall {
  if (!isRecord(value) || !Array.isArray(value.args)) {
    return false;
  }
  if (value.name === 'variable' || value.name === 'variableValue') {
    return value.args.length === 1 && typeof value.args[0] === 'string' && value.args[0].length <= 10_000;
  }
  return (
    value.name === 'date' &&
    value.args.length <= 2 &&
    value.args.every(
      (arg) =>
        arg === undefined ||
        arg === null ||
        arg instanceof Date ||
        typeof arg === 'number' ||
        (typeof arg === 'string' && arg.length <= 10_000)
    )
  );
}
export function helperKey(call: HelperCall): string {
  return JSON.stringify([
    call.name,
    call.args.map((arg) => (arg instanceof Date ? ['date', arg.getTime()] : [typeof arg, String(arg)])),
  ]);
}
export function isRenderRequest(value: unknown): value is RenderRequest {
  return (
    isRecord(value) &&
    value.protocol === PROTOCOL &&
    typeof value.channel === 'string' &&
    value.type === 'render' &&
    Number.isSafeInteger(value.id) &&
    typeof value.template === 'string' &&
    value.template.length <= MAX_TEMPLATE_CHARS &&
    isRecord(value.data) &&
    typeof value.trackRows === 'boolean' &&
    Array.isArray(value.helpers) &&
    value.helpers.length <= MAX_HELPERS &&
    value.helpers.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === 'string' &&
        item[0].length <= 25_000 &&
        isHelperValue(item[1])
    )
  );
}
export function isNotification(value: unknown): value is Notification & { protocol: string; channel: string } {
  if (!isRecord(value) || value.protocol !== PROTOCOL || typeof value.channel !== 'string') {
    return false;
  }
  if (value.type === 'ready') {
    return true;
  }
  if (!Number.isSafeInteger(value.id)) {
    return false;
  }
  switch (value.type) {
    case 'result':
      return (
        typeof value.content === 'string' &&
        value.content.length <= MAX_OUTPUT_CHARS &&
        typeof value.readRows === 'boolean' &&
        Number.isSafeInteger(value.compilations)
      );
    case 'helper':
      return isHelperCall(value.call);
    case 'error':
      return typeof value.error === 'string' && value.error.length <= MAX_ERROR_CHARS;
    default:
      return false;
  }
}
