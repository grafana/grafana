import { DataLinkTransformationConfig } from '@grafana/data';

export interface AddCorrelationResponse {
  correlation: Correlation;
}

export type GetCorrelationsResponse = Correlation[];

type CorrelationConfigType = 'query';

export interface CorrelationConfig {
  field: string;
  target: object;
  type: CorrelationConfigType;
  transformations?: DataLinkTransformationConfig[];
}

export interface Correlation {
  uid: string;
  sourceUID: string;
  targetUID: string;
  label?: string;
  description?: string;
  config: CorrelationConfig;
}

export type RemoveCorrelationParams = Pick<Correlation, 'sourceUID' | 'uid'>;
export type CreateCorrelationParams = Omit<Correlation, 'uid'>;
export type UpdateCorrelationParams = Omit<Correlation, 'targetUID'>;
