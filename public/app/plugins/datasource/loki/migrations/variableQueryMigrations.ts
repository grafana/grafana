import { LokiVariableQuery, LokiVariableQueryType } from '../types';

export const labelNamesRegex = /^label_names\(\)\s*$/;
export const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_$][a-zA-Z0-9_]*)\)\s*$/;

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
    return {
      ...queryBase,
      type: LokiVariableQueryType.LabelValues,
      label: labelValues[2] ? labelValues[2] : labelValues[1],
      stream: labelValues[2] ? labelValues[1] : undefined,
    };
  }

  return queryBase;
}
