//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import { DataQuery, DataSourceJsonData } from '@grafana/data';

export const modelVersion = Object.freeze([1, 0]);

export interface MySQLOptions extends DataSourceJsonData {
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface MySQLQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: string;
}
