import { type DataQueryError } from '@grafana/data';

export const SOFT_BLOCK_MARKER = '[guardrail_soft_block]';
export const MIN_SOFT_BLOCK_REASON_LENGTH = 10;

/**
 * The canonical request header names that carry a soft-block override. Header names supplied by the
 * server are intentionally ignored; these names are always used.
 */
export const SOFT_BLOCK_HEADER_NAMES = {
  token: 'X-Grafana-Guardrail-Override',
  reason: 'X-Grafana-Guardrail-Override-Reason',
} as const;

const SOFT_BLOCK_CODE = 'guardrail_soft_block';
// The gateway appends this agent-directed sentence to the readable message; it is stripped before display.
const CONFIRM_SENTENCE = 'Confirm with the user before retrying.';

export interface ParsedSoftBlockError {
  text: string;
  token: string;
}

/**
 * Parses a per-refId soft-block error message of the shape
 * `<readable text> [guardrail_soft_block] <json>` (optionally followed by extra text such as a Trace
 * ID line). Returns null when the message is not a valid soft-block error.
 */
export function parseSoftBlockError(message: string | undefined): ParsedSoftBlockError | null {
  if (!message) {
    return null;
  }

  const markerIndex = message.indexOf(SOFT_BLOCK_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const afterMarker = message.slice(markerIndex + SOFT_BLOCK_MARKER.length);
  const extracted = extractJsonObject(afterMarker);
  if (!extracted) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(extracted.json);
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const { code, token } = payload;
  if (code !== SOFT_BLOCK_CODE || typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return {
    text: buildReadableText(message.slice(0, markerIndex), extracted.rest),
    token,
  };
}

export function isValidSoftBlockReason(reason: string): boolean {
  return reason.trim().length >= MIN_SOFT_BLOCK_REASON_LENGTH;
}

/**
 * Builds the transient request headers that carry a soft-block override: the de-duplicated,
 * comma-joined tokens and the trimmed reason, under the canonical header names.
 */
export function buildSoftBlockOverrideHeaders(tokens: string[], reason: string): Record<string, string> {
  return {
    [SOFT_BLOCK_HEADER_NAMES.token]: dedupeTokens(tokens).join(','),
    [SOFT_BLOCK_HEADER_NAMES.reason]: reason.trim(),
  };
}

/**
 * Collects the de-duplicated override tokens across a set of query errors.
 */
export function collectSoftBlockTokens(errors: Array<Pick<DataQueryError, 'message'>> | undefined): string[] {
  const tokens: string[] = [];

  for (const error of errors ?? []) {
    const parsed = parseSoftBlockError(error.message);
    if (parsed) {
      tokens.push(parsed.token);
    }
  }

  return dedupeTokens(tokens);
}

function buildReadableText(beforeMarker: string, afterJson: string): string {
  let text = beforeMarker.trim();
  if (text.endsWith(CONFIRM_SENTENCE)) {
    text = text.slice(0, -CONFIRM_SENTENCE.length).trim();
  }

  const trailing = afterJson.trim();
  if (trailing) {
    text = text ? `${text}\n${trailing}` : trailing;
  }

  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function dedupeTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter((token) => token.length > 0))];
}

/**
 * Extracts the first brace-balanced JSON object from `text`, respecting strings and escapes so
 * braces or quotes inside string values do not terminate the scan early. Returns the object source
 * and whatever follows it, or null when no complete object is found.
 */
function extractJsonObject(text: string): { json: string; rest: string } | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return { json: text.slice(start, i + 1), rest: text.slice(i + 1) };
      }
    }
  }

  return null;
}
