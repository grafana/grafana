import { DataLinkTransformationConfig, DataSourceInstanceSettings, Field, LinkModel } from '@grafana/data';

import { VariableInterpolation } from '../services';

export interface ExploreFieldLinkModel extends LinkModel<Field> {
  variables: VariableInterpolation[];
}
export type DataFrameRefIdToDataSourceUid = Record<string, string>;

export type CorrelationData =
  | (Omit<CorrelationExternal, 'sourceUID'> & {
      source: DataSourceInstanceSettings;
    })
  | (Omit<CorrelationQuery, 'sourceUID' | 'targetUID'> & {
      source: DataSourceInstanceSettings;
      target: DataSourceInstanceSettings;
    });

export interface CorrelationsData {
  correlations: CorrelationData[];
  page: number;
  limit: number;
  totalCount: number;
}

export type CorrelationType = 'query' | 'external';

export type ExternalTypeTarget = { url: string };

export type CorrelationConfigQuery = {
  field: string;
  target: object; // for queries, this contains anything that would go in the query editor, so any extension off DataQuery a datasource would have, and needs to be generic.
  transformations?: DataLinkTransformationConfig[];
};

export type CorrelationConfigExternal = {
  field: string;
  target: ExternalTypeTarget; // For external, this simply contains a URL
  transformations?: DataLinkTransformationConfig[];
};

type CorrelationBase = {
  uid: string;
  sourceUID: string;
  label?: string;
  description?: string;
  provisioned: boolean;
  orgId?: number;
};

export type CorrelationExternal = CorrelationBase & {
  type: 'external';
  config: CorrelationConfigExternal;
};

export type CorrelationQuery = CorrelationBase & {
  type: 'query';
  config: CorrelationConfigQuery;
  targetUID: string;
};

export type Correlation = CorrelationExternal | CorrelationQuery;

export interface CorrelationsResponse {
  correlations: Correlation[];
  page: number;
  limit: number;
  totalCount: number;
}
