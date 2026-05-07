import { type LokiVariableQuery, LokiVariableQueryType } from '../types';

export const labelNamesRegex = /^label_names\(\)\s*$/;
export const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_$][a-zA-Z0-9_]*)\)\s*$/;

/**
 * Ensures a stream selector string is wrapped in curly braces.
 * LogQL requires stream selectors to be enclosed in `{...}`, but the
 * label_values() regex and UI previously allowed bare selectors like
 * `job="foo"`. This helper normalises such values to `{job="foo"}`.
 */
export function ensureStreamSelectorBraces(selector: string): string {
  const trimmed = selector.trim();
  if (trimmed === '' || trimmed === '{}') {
    return trimmed;
  }
  if (trimmed.startsWith('{')) {
    return trimmed;
  }
  return `{${trimmed}}`;
}

export function migrateVariableQuery(rawQuery: string | LokiVariableQuery): LokiVariableQuery {
  // If not string, we assume LokiVariableQuery
  if (typeof rawQuery !== 'string') {
    return rawQuery;
  }

  const queryBase = {
    refId: 'LokiVariableQueryEditor-VariableQuery',
    type: LokiVariableQueryType.LabelNames,
  };

  const labelNames = rawQuery.match(labelNamesRegex);
  if (labelNames) {
    return {
      ...queryBase,
      type: LokiVariableQueryType.LabelNames,
    };
  }

  const labelValues = rawQuery.match(labelValuesRegex);
  if (labelValues) {
    const label = labelValues[2] ? labelValues[2] : labelValues[1];
    const rawStream = labelValues[2] ? labelValues[1] : undefined;
    return {
      ...queryBase,
      type: LokiVariableQueryType.LabelValues,
      label,
      stream: rawStream ? ensureStreamSelectorBraces(rawStream) : undefined,
    };
  }

  return queryBase;
}
