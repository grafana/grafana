import { escapeRegExp } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { AggregateFunctions, QueryEditorPropertyType } from '../../types';

import { QueryEditorReduceExpression } from './expressions';

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

export function sanitizeAggregate(expression: QueryEditorReduceExpression): QueryEditorReduceExpression | undefined {
  const func = expression.reduce?.name;
  const column = expression.property?.name;

  if (func) {
    switch (func) {
      case AggregateFunctions.Count:
        return expression;
      case AggregateFunctions.Percentile:
        if (column && expression.parameters?.length) {
          return expression;
        }
        break;
      default:
        if (column) {
          return expression;
        }
    }
  }

  return undefined;
}

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
  let prevFilters = '';
  let prevAggregates = '';
  let prevGroupBy: string[] = [];

  const whereMatch = query.match(/\| where (.+)/);
  if (whereMatch) {
    prevFilters = whereMatch[1].split('|')[0].trim();
  }

  const summarizeMatch = query.match(/\| summarize (.+)/);
  if (summarizeMatch) {
    const parts = summarizeMatch[1].split(' by ');
    prevAggregates = parts[0].trim();
    if (parts[1]) {
      prevGroupBy = parts[1].split(',').map((g) => g.trim());
    }
  }

  return { prevFilters, prevAggregates, prevGroupBy };
};
