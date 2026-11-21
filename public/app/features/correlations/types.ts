import { type CorrelationExternal, type CorrelationQuery } from '@grafana/runtime';

interface CorrelationsApiResponse {
  message: string;
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

// key names match the grafana_explore_correlation_editor_saved interaction so the events can be compared
export type CorrelationInteractionDetails = {
  correlationType: CorrelationType;
  sourceDatasourceType: string;
  targetDataSourceType?: string;
};

export type Correlation = CorrelationExternal | CorrelationQuery;

export type GetCorrelationsParams = {
  page: number;
};

export type OmitUnion<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = OmitUnion<Correlation, 'uid' | 'provisioned'>;
export type UpdateCorrelationParams = OmitUnion<Correlation, 'targetUID' | 'provisioned'>;
