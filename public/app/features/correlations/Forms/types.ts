import { SupportedTransformationType } from '@grafana/data';

import { CorrelationConfig } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

export type EditFormDTO = Omit<FormDTO, 'targetUID' | 'sourceUID'>;

export type TransformationDTO = {
  type: SupportedTransformationType;
  expression?: string;
  mapValue?: string;
};
