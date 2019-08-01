import { Field, FieldType, DataFrame } from '../types/dataFrame';

/**
 * This object has a 'get' property for each field name
 * and can be accessed by column index
 */
export class RowCursor<T = any> implements IterableIterator<T> {
  private cursor = 0;

  constructor(private fields: Field[]) {
    for (let i = 0; i < fields.length; i++) {
      const getter = {
        get: () => {
          return this.getFieldValue(i);
        },
      };
      Object.defineProperty(this, fields[i].name, getter);
      Object.defineProperty(this, i, getter);
    }
  }

  getFieldValue(column: number): any {
    return this.fields[column].values[this.cursor];
  }

  next(): IteratorResult<T> {
    const len = this.fields[0].values.length;
    const done = this.cursor++ > len;
    return { done, value: (this as unknown) as T };
  }

  [Symbol.iterator](): IterableIterator<T> {
    this.cursor = 0; // reset to the beginning
    return this;
  }
}

export function createField<T>(name: string, type?: FieldType, values?: T[]) {
  return {
    name,
    type,
    values: values ? values : [],
  };
}

/**
 * Wrapper to get an array from each field value
 */
export function getDataFrameRow(data: DataFrame, row: number): any[] {
  const values: any[] = [];
  for (const field of data.fields) {
    values.push(field.values[row]);
  }
  return values;
}

export function getDataFrameRowCount(data: DataFrame) {
  if (data && data.fields && data.fields.length) {
    // Assume the rest are the same size
    return data.fields[0].values.length;
  }
  return 0;
}
