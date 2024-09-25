import { DataLinkTransformationConfig } from '@grafana/data';

export interface AddCorrelationResponse {
  correlation: Correlation;
}

export type GetCorrelationsResponse = Correlation[];

export interface CorrelationsApiResponse {
  message: string;
}

export interface CorrelationsErrorResponse extends CorrelationsApiResponse {
  error: string;
}

export interface CreateCorrelationResponse extends CorrelationsApiResponse {
  result: Correlation;
}

export interface UpdateCorrelationResponse extends CorrelationsApiResponse {
  result: Correlation;
}

export interface RemoveCorrelationResponse {
  message: string;
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

export type GetCorrelationsParams = {
  page: number;
};

export type OmitUnion<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = OmitUnion<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = OmitUnion<Correlation, 'targetUID' | 'provisioned'>;
