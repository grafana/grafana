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

type CorrelationTypeOptions = {
  value: string;
  label: string;
  description: string;
};

export const CORR_TYPES: Record<string, CorrelationTypeOptions> = {
  query: {
    value: 'query',
    label: 'Query',
    description: 'Open a query',
  },
  external: {
    value: 'external',
    label: 'External',
    description: 'Open an external URL',
  },
};

//const corrTypeArray = Object.values(CORR_TYPES).map((ct) => ct.value);

export type CorrelationType = 'query' | 'external'; //(typeof corrTypeArray)[number];

export type ExternalTypeTarget = { url: string };

export type CorrelationConfig = {
  field: string;
  target: object | ExternalTypeTarget; // for queries, this contains anything that would go in the query editor, so any extension off DataQuery a datasource would have, and needs to be generic. For external, it simply contains a URL
  transformations?: DataLinkTransformationConfig[];
};

type CorrelationBase = {
  uid: string;
  sourceUID: string;
  label?: string;
  description?: string;
  provisioned: boolean;
  orgId?: number;
  config: CorrelationConfig;
  type: CorrelationType;
};

type CorrelationExternal = CorrelationBase & {
  type: 'external';
  targetUID: undefined;
};

type CorrelationQuery = CorrelationBase & {
  type: 'query';
  targetUID: string;
};

export type Correlation = CorrelationExternal | CorrelationQuery;

export type GetCorrelationsParams = {
  page: number;
};

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = Omit<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = Omit<Correlation, 'targetUID' | 'provisioned'>;
