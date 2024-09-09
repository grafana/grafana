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

export type CorrelationType = 'query';

export interface CorrelationConfig {
  field: string;
  target: object; // this contains anything that would go in the query editor, so any extension off DataQuery a datasource would have, and needs to be generic
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
  type: CorrelationType;
}

export type GetCorrelationsParams = {
  page: number;
};

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = Omit<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = Omit<Correlation, 'targetUID' | 'provisioned'>;
