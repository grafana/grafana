export interface AddCorrelationResponse {
  correlation: Correlation;
}

export type GetCorrelationsResponse = Correlation[];

type CorrelationConfigType = 'query';

export interface Transformation {
  type: 'logfmt' | 'regex' | 'path' | 'none';
  field: string;
  variable?: string;
  mappings?: object;
  expression?: string;
}

export interface CorrelationConfig {
  field: string;
  target: object;
  transformations: Transformation[];
  type: CorrelationConfigType;
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
