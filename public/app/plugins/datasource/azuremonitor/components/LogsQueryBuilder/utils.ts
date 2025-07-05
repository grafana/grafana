import { escapeRegExp } from 'lodash';

import { SelectableValue } from '@grafana/data';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorOrderByExpression,
  BuilderQueryEditorPropertyExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryEditorWhereExpression,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types/logAnalyticsMetadata';
import { AzureMonitorQuery } from '../../types/query';

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

export const removeExtraQuotes = (value: string): string => {
  let strValue = String(value).trim();
  if ((strValue.startsWith("'") && strValue.endsWith("'")) || (strValue.startsWith('"') && strValue.endsWith('"'))) {
    return strValue.slice(1, -1);
  }
  return strValue;
};

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
  basicLogsQuery?: boolean;
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
