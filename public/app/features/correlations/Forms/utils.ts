import { Correlation } from '../types';

type CorrelationBaseData = Pick<Correlation, 'uid' | 'sourceUID'>;

export const getInputId = (inputName: string, correlation?: CorrelationBaseData) => {
  if (!correlation) {
    return inputName;
  }

  return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};
