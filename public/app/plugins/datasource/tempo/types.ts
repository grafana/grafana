import { DataSourceJsonData } from '@grafana/data/src';

import { TempoQuery } from './datasource';

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};
