import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface RSSFeedQuery extends DataQuery {}

export interface RSSFeedOptions extends DataSourceJsonData {
  // Saved in the datasource and download with bootData
  feedUrl?: string;
}
