import { KeyValue } from '../types/data';
import { Field } from '../types/dataFrame';

export interface Dimension<T = any> {
  // Name of the dimension
  name: string;
  // Collection of fields representing dimension
  // I.e. in 2d graph we have two dimension- X and Y axes. Both dimensions can represent
  // multiple fields being drawn on the graph.
  // For instance y-axis dimension is a collection of series value fields,
  // and x-axis dimension is a collection of corresponding time fields
  columns: Array<Field<T>>;
}

export type Dimensions = KeyValue<Dimension>;

export const createDimension = (name: string, columns: Field[]): Dimension => {
  return {
    name,
    columns,
  };
};

export const getColumnsFromDimension = (dimension: Dimension) => {
  return dimension.columns;
};
export const getColumnFromDimension = (dimension: Dimension, column: number) => {
  return dimension.columns[column];
};

export const getValueFromDimension = (dimension: Dimension, column: number, row: number) => {
  return dimension.columns[column].values.get(row);
};

export const getAllValuesFromDimension = (dimension: Dimension, column: number, row: number) => {
  return dimension.columns.map((c) => c.values.get(row));
};

export const getDimensionByName = (dimensions: Dimensions, name: string) => dimensions[name];
