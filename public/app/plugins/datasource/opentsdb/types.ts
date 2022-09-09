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
