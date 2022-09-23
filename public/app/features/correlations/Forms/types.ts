import { CorrelationConfig } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

type FormDTOWithoutTarget = Omit<FormDTO, 'targetUID' | 'sourceUID'>;
export type EditFormDTO = FormDTOWithoutTarget;
