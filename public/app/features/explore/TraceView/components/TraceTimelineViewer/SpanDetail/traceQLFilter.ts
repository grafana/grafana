import { type TraceKeyValuePair } from '@grafana/data';

import { type AttributeSectionType } from './attributeCategories';

// TraceQL is Tempo's query language; only the built-in Tempo datasource plugin supports it.
export const TEMPO_DATASOURCE_TYPE = 'tempo';

// TraceQL bare identifiers: a dotted path of bare segments (each segment starts with a letter or
// underscore, then letters/digits/underscores), e.g. the OTel-style `http.status_code`. Anything
// else must be quoted, including keys with spaces and malformed dotting (leading/trailing/doubled
// dots or a segment starting with a digit) that would otherwise emit invalid TraceQL like `span.foo.`.
const BARE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

// Mirrors the escaping the Tempo datasource applies to TraceQL string values (its getEscapedValues)
// so a copied condition matches what Tempo's own query editor produces: backslash and double-quote
// are backslash-prefixed, then newlines become a literal `\n`. Order matters, otherwise the
// backslash inserted for a newline would itself be escaped on a second pass.
function escapeTraceQLString(value: string): string {
  return value.replace(/["\\]/g, '\\$&').replace(/[\n]/g, '\\n');
}

function formatTraceQLKey(key: string, scope: AttributeSectionType): string {
  if (BARE_KEY_PATTERN.test(key)) {
    return `${scope}.${key}`;
  }
  return `${scope}."${escapeTraceQLString(key)}"`;
}

/**
 * Builds a bare TraceQL span/resource attribute condition, e.g. `span.http.status_code = 200`, from
 * a single attribute row, without the surrounding `{ }` so it can be pasted directly into an
 * existing filter and combined with `&&`/`||`. Returns null if there's no valid scalar condition to
 * generate for it (e.g. the value is a JSON object/array, which TraceQL can't compare against).
 */
export function attributeToTraceQLFilter(pair: TraceKeyValuePair, scope: AttributeSectionType): string | null {
  const { key, value } = pair;
  if (!key) {
    return null;
  }

  let formattedValue: string;
  if (typeof value === 'string') {
    formattedValue = `"${escapeTraceQLString(value)}"`;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    formattedValue = String(value);
  } else {
    return null;
  }

  return `${formatTraceQLKey(key, scope)} = ${formattedValue}`;
}
