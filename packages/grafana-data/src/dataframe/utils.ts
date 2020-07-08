import { DataFrame, FieldType } from '../types/dataFrame';

export const isTimeSerie = (frame: DataFrame): boolean => {
  if (frame.fields.length > 2) {
    return false;
  }
  return !!frame.fields.find(field => field.type === FieldType.time);
};

export const isTimeSeries = (data: DataFrame[]): boolean => {
  return !data.find(frame => !isTimeSerie(frame));
};
