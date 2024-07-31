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

type ConfigType = {
  value: string;
  label: string;
  description: string;
  targetDescriptionKey: string;
  targetDescriptionFallback: string;
};

export const CORR_CONFIG_TYPES: Record<string, ConfigType> = {
  query: {
    value: 'query',
    label: 'Query',
    description: 'Open a query',
    targetDescriptionKey: 'correlations.target-form.target-query-description',
    targetDescriptionFallback: 'Specify which data source is queried when the link is clicked',
  },
  external: {
    value: 'external',
    label: 'External',
    description: 'Open an external URL',
    targetDescriptionKey: 'correlations.target-form.target-external-description',
    targetDescriptionFallback: 'Specify the URL that will open when the link is clicked',
  },
};

const corrTypeArray = Object.values(CORR_CONFIG_TYPES).map((ct) => ct.value);

export type CorrelationConfigType = (typeof corrTypeArray)[number];

export type ExternalTypeTarget = { url: string };

export interface CorrelationConfig {
  field: string;
  target: object | ExternalTypeTarget; // for queries, this contains anything that would go in the query editor, so any extension off DataQuery a datasource would have, and needs to be generic. For external, it simply contains a URL
  type: CorrelationConfigType; //I give up
  transformations?: DataLinkTransformationConfig[];
}

export interface Correlation {
  uid: string;
  sourceUID: string;
  targetUID: string;
  label?: string;
  description?: string;
  provisioned: boolean;
  orgId?: number;
  config: CorrelationConfig;
}

export type GetCorrelationsParams = {
  page: number;
};

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = Omit<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = Omit<Correlation, 'targetUID' | 'provisioned'>;
