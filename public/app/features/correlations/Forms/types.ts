import { CorrelationConfig } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

export type EditFormDTO = Omit<FormDTO, 'targetUID' | 'sourceUID'>;
