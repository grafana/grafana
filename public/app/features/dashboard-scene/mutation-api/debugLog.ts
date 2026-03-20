import { store } from '@grafana/data';

export function createDebugLog(key: string, prefix: string) {
  const storageKey = `grafana.debug.${key}`;

  return function debugLog(message: string, ...args: unknown[]) {
    if (store.get(storageKey) === 'true') {
      console.log(`[${prefix}] ${message}`, ...args);
    }
  };
}

export const debugLog = createDebugLog('mutationAPI', 'Mutation API');

/**
 * Produce a redacted summary of a mutation payload safe for debug logging.
 * Shows structure (keys, types, array lengths) without exposing values.
 */
export function safeDebugPayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }
  if (typeof payload !== 'object') {
    if (typeof payload === 'string') {
      return payload.length > 80 ? `${payload.slice(0, 80)}… (${payload.length} chars)` : payload;
    }
    return payload;
  }
  if (Array.isArray(payload)) {
    return `[Array(${payload.length})]`;
  }
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      summary[key] = `[Array(${value.length})]`;
    } else if (typeof value === 'object') {
      summary[key] = `{${Object.keys(value).join(', ')}}`;
    } else if (typeof value === 'string' && value.length > 80) {
      summary[key] = `${value.slice(0, 80)}… (${value.length} chars)`;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}
