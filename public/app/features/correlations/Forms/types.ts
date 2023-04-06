import { CorrelationConfig, TransformationType } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

export type EditFormDTO = Omit<FormDTO, 'targetUID' | 'sourceUID'>;

export type TransformationDTO = {
  type: TransformationType;
  expression?: string;
  mapValue?: string;
};

export const emptyTransformation: TransformationDTO = {
  type: TransformationType.Logfmt,
};
