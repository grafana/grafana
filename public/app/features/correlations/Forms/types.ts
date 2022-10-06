import { Correlation } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
}

type FormDTOWithoutTarget = Omit<FormDTO, 'targetUID'>;
export type EditFormDTO = Partial<FormDTOWithoutTarget> & Pick<FormDTO, 'sourceUID'> & { uid: Correlation['uid'] };
