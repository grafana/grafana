import { Correlation, CorrelationConfig } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

type FormDTOWithoutTarget = Omit<FormDTO, 'targetUID'>;
export type EditFormDTO = Partial<FormDTOWithoutTarget> &
  Pick<FormDTO, 'sourceUID' | 'config'> & { uid: Correlation['uid'] };
