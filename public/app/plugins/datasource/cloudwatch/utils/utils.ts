import { SelectableValue } from '@grafana/data';

import { CloudWatchDatasource } from './../datasource';

export const toOption = (value: string) => ({ label: value, value });

export const appendTemplateVariables = (datasource: CloudWatchDatasource, values: SelectableValue[]) => [
  ...values,
  { label: 'Template Variables', options: datasource.getVariables().map(toOption) },
];
