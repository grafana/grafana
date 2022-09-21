import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface OpenTsdbQuery extends DataQuery {
  // migrating to react
  // metrics section
  metric?: string;
  aggregator?: string;
  alias?: string;

  //downsample section
  downsampleInterval?: string;
  downsampleAggregator?: string;
  downsampleFillPolicy?: string;
  disableDownsampling?: boolean;

  //filters
  filters?: OpenTsdbFilter[];

  //tags
  tags?: OpenTsdbTag[];

  // annotation attrs
  fromAnnotations?: boolean;
  isGlobal?: boolean;
  target?: string;
  name?: string;
}

export interface OpenTsdbOptions extends DataSourceJsonData {
  tsdbVersion: number;
  tsdbResolution: number;
  lookupLimit: number;
}

export type LegacyAnnotation = {
  fromAnnotations?: boolean;
  isGlobal?: boolean;
  target?: string;
  name?: string;
};

export type OpenTsdbFilter = {
  type: string;
  tagk: string;
  filter: string;
  groupBy: boolean;
};

export type OpenTsdbTag = {};
