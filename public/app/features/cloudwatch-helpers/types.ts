import { type DataQuery } from '@grafana/schema';

import type * as raw from './dataquery';

export interface LegacyAnnotationQuery extends raw.MetricStat, DataQuery {
  actionPrefix: string;
  alarmNamePrefix: string;
  alias: string;
  builtIn: number;
  datasource: any;
  dimensions: raw.Dimensions;
  enable: boolean;
  expression: string;
  hide: boolean;
  iconColor: string;
  id: string;
  matchExact: boolean;
  metricName: string;
  name: string;
  namespace: string;
  period: string;
  prefixMatching: boolean;
  region: string;
  statistic: string;
  statistics: string[];
  target: {
    limit: number;
    matchAny: boolean;
    tags: any[];
    type: string;
  };
  type: string;
}
