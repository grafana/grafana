import { escapeRegExp } from 'lodash';

import { SelectableValue } from '@grafana/data';

import {
  BuilderQueryExpression,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryEditorWhereExpression,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorOrderByExpression,
  BuilderQueryEditorPropertyExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, QueryEditorPropertyType, AzureMonitorQuery } from '../../types';

const DYNAMIC_TYPE_ARRAY_DELIMITER = '["`indexer`"]';
export const inputFieldSize = 20;

export const valueToDefinition = (name: string) => {
  return {
    value: name,
    label: name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
  };
};

export const DEFAULT_LOGS_BUILDER_QUERY: BuilderQueryExpression = {
  columns: { columns: [], type: BuilderQueryEditorExpressionType.Property },
  from: {
    type: BuilderQueryEditorExpressionType.Property,
    property: { type: BuilderQueryEditorPropertyType.String, name: '' },
  },
  groupBy: { expressions: [], type: BuilderQueryEditorExpressionType.Group_by },
  reduce: { expressions: [], type: BuilderQueryEditorExpressionType.Reduce },
  where: { expressions: [], type: BuilderQueryEditorExpressionType.And },
  limit: 1000,
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

export const getAggregations = (reduceExpressions: BuilderQueryEditorReduceExpression[] = []) => {
  return reduceExpressions
    .map((agg) => {
      if (agg.reduce?.name === 'count()' && agg.property?.name === '') {
        return 'count()';
      }

      if (agg.reduce?.name === 'count()') {
        return `count(${agg.property?.name})`;
      }

      if (agg.property?.name === '') {
        return `${agg.reduce?.name}`;
      } else {
        return `${agg.reduce?.name}(${agg.property?.name})`;
      }
    })
    .join(', ');
};

export const getFilters = (whereExpressions: BuilderQueryEditorWhereExpression[] = []) => {
  return whereExpressions
    .map((exp) => {
      if ('property' in exp && exp.property?.name && exp.operator?.name && exp.operator?.value !== undefined) {
        if (exp.operator.name === 'has') {
          return null;
        }
        return `${exp.property.name} ${exp.operator.name} ${exp.operator.value}`;
      }
      return null;
    })
    .filter((filter) => filter !== null)
    .join(' and ');
};

export const removeExtraQuotes = (value: string): string => {
  let strValue = String(value).trim();
  if ((strValue.startsWith("'") && strValue.endsWith("'")) || (strValue.startsWith('"') && strValue.endsWith('"'))) {
    return strValue.slice(1, -1);
  }
  return strValue;
};

// const getDatetimeColumn = (columns: AzureLogAnalyticsMetadataColumn[]): string => {
//   return columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';
// };
export interface BuildAndUpdateOptions {
  query: AzureMonitorQuery;
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  limit?: number;
  reduce?: BuilderQueryEditorReduceExpression[];
  where?: BuilderQueryEditorWhereExpression[];
  fuzzySearch?: BuilderQueryEditorWhereExpression[];
  groupBy?: BuilderQueryEditorGroupByExpression[];
  orderBy?: BuilderQueryEditorOrderByExpression[];
  columns?: string[];
  from?: BuilderQueryEditorPropertyExpression;
}

export const aggregateOptions = [
  { label: 'sum', value: 'sum' },
  { label: 'avg', value: 'avg' },
  { label: 'percentile', value: 'percentile' },
  { label: 'count', value: 'count' },
  { label: 'min', value: 'min' },
  { label: 'max', value: 'max' },
  { label: 'dcount', value: 'dcount' },
  { label: 'stdev', value: 'stdev' },
];
