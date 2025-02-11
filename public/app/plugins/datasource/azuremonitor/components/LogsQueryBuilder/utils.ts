import { escapeRegExp } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { AggregateFunctions, QueryEditorPropertyType } from '../../types';

import { QueryEditorExpression } from './expressions';

const DYNAMIC_TYPE_ARRAY_DELIMITER = '["`indexer`"]';
export const valueToDefinition = (name: string) => {
  return {
    value: name,
    label: name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
  };
};

export const OPERATORS_BY_TYPE: Record<string, Array<SelectableValue<string>>> = {
  string: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: 'contains', value: 'contains' },
    { label: '!contains', value: '!contains' },
    { label: 'startswith', value: 'startswith' },
    { label: 'endswith', value: 'endswith' },
  ],
  int: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
  ],
  datetime: [
    { label: 'before', value: '<' },
    { label: 'after', value: '>' },
    { label: 'between', value: 'between' },
  ],
  bool: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
  ],
};

export const toOperatorOptions = (type: string): Array<SelectableValue<string>> => {
  return OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.string;
};

export interface QueryEditorPropertyDefinition {
  value: string;
  type: QueryEditorPropertyType;
  label?: string;
  dynamic?: boolean;
}

export const columnsToDefinition = (columns: SelectableValue<string>): QueryEditorPropertyDefinition[] => {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns.map((column) => {
    return {
      value: column.name,
      label: column.name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
      type: toPropertyType(column.type),
    };
  });
};

export const toPropertyType = (kustoType: string): QueryEditorPropertyType => {
  switch (kustoType) {
    case 'real':
    case 'int':
    case 'long':
    case 'double':
    case 'decimal':
      return QueryEditorPropertyType.Number;
    case 'datetime':
      return QueryEditorPropertyType.DateTime;
    case 'bool':
      return QueryEditorPropertyType.Boolean;
    case 'timespan':
      return QueryEditorPropertyType.TimeSpan;
    default:
      return QueryEditorPropertyType.String;
  }
};

export const parseQuery = (query: string) => {
  let prevFilters: string | undefined = undefined;
  let prevAggregates: string | undefined = undefined;
  let prevGroupBy: string[] | undefined = undefined;

  const whereMatch = query.match(/\| where (.+)/);
  if (whereMatch) {
    prevFilters = whereMatch[1].split('|')[0].trim();
  }

  const summarizeMatch = query.match(/\| summarize (.+)/);
  if (summarizeMatch) {
    const summarizeContent = summarizeMatch[1].trim();
    const parts = summarizeContent.split(" by ");

    if (parts.length > 1) {
      // 🔥 There is a `by` clause → Treat as GroupBy
      prevGroupBy = parts[1]
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g !== ""); // Remove empty values

      // ✅ Only set prevAggregates if it contains an actual function (not just count())
      prevAggregates = parts[0].trim();
      if (prevAggregates === "count()") {
        prevAggregates = undefined; // ✅ `count()` in GroupBy is NOT an aggregate
      }
    } else {
      // 🔥 No `by` clause → This is an actual aggregation
      prevAggregates = summarizeContent.trim() || undefined;
      prevGroupBy = undefined; // ✅ No groupBy in this case
    }
  }

  // 🔥 Ensure `prevGroupBy` is undefined if it's empty
  if (prevGroupBy && prevGroupBy.length === 0) {
    prevGroupBy = undefined;
  }

  console.log("Parsed Query:", { prevFilters, prevAggregates, prevGroupBy });

  return { prevFilters, prevAggregates, prevGroupBy };
};

