import { SelectableValue } from '@grafana/data';

import { CloudWatchMetricsQuery, MetricQueryType, MetricEditorMode } from '../types';

import { CloudWatchDatasource } from './../datasource';

export const toOption = (value: string) => ({ label: value, value });

export const appendTemplateVariables = (datasource: CloudWatchDatasource, values: SelectableValue[]) => [
  ...values,
  { label: 'Template Variables', options: datasource.getVariables().map(toOption) },
];

export const filterMetricsQuery = (query: CloudWatchMetricsQuery): boolean => {
  const { region, metricQueryType, metricEditorMode, expression, metricName, namespace, sqlExpression, statistic } =
    query;
  if (!region) {
    return false;
  }
  if (metricQueryType === MetricQueryType.Search && metricEditorMode === MetricEditorMode.Builder) {
    return !!namespace && !!metricName && !!statistic;
  } else if (metricQueryType === MetricQueryType.Search && metricEditorMode === MetricEditorMode.Code) {
    return !!expression;
  } else if (metricQueryType === MetricQueryType.Query) {
    // still TBD how to validate the visual query builder for SQL
    return !!sqlExpression;
  }

  return false;
};

/*
Currently supported arn formats:
  arn:partition:service:region:account-id:resource-id
  arn:partition:service:region:account-id:resource-type/resource-id
  arn:partition:service:region:account-id:resource-type:resource-id
*/
export const getAccountIdArn = (logArn: string) => {
  const arnPieces = logArn.split(':');
  if (arnPieces.length < 5) {
    console.error(`Unexpected Error, unable to parse accountID from arn, ${logArn}`);
    return 'Unknown account id';
  }
  return arnPieces[4];
};
