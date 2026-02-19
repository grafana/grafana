import { FieldConfig } from '@grafana/data';

export type LogsVisualisationType = 'table' | 'logs';
// @todo field config types
export const exploreLogsTableFieldConfigDefaults: FieldConfig = {
  filterable: true,
  custom: {
    filterable: true,
  },
};
