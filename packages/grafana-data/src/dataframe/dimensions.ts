import { KeyValue } from '../types/data';
import { Field } from '../types/dataFrame';

export interface Dimension<T = unknown> {
  // Name of the dimension
  name: string;
  // Collection of fields representing dimension
  // I.e. in 2d graph we have two dimension- X and Y axes. Both dimensions can represent
  // multiple fields being drawn on the graph.
  // For instance y-axis dimension is a collection of series value fields,
  // and x-axis dimension is a collection of corresponding time fields
  columns: Array<Field<T>>;
}

export type Dimensions<T = unknown> = KeyValue<Dimension<T>>;

export const createDimension = <T>(name: string, columns: Array<Field<T>>): Dimension<T> => {
  return {
    name,
    columns,
  };
};

export const getColumnsFromDimension = <T>(dimension: Dimension<T>) => {
  return dimension.columns;
};
export const getColumnFromDimension = <T>(dimension: Dimension<T>, column: number) => {
  return dimension.columns[column];
};

export const getValueFromDimension = <T>(dimension: Dimension<T>, column: number, row: number) => {
  return dimension.columns[column].values[row];
};

export const getAllValuesFromDimension = <T>(dimension: Dimension<T>, column: number, row: number) => {
  return dimension.columns.map((c) => c.values[row]);
};

export const getDimensionByName = <T>(dimensions: Dimensions<T>, name: string) => dimensions[name];
