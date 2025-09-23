import { CorrelationExternal, CorrelationQuery } from '@grafana/runtime';

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

export type Correlation = CorrelationExternal | CorrelationQuery;

export type GetCorrelationsParams = {
  page: number;
};

export type OmitUnion<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = OmitUnion<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = OmitUnion<Correlation, 'targetUID' | 'provisioned'>;
