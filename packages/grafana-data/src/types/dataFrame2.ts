import { FieldType, QueryResultBase, Labels } from './data';
import { ValueMapping } from './valueMapping';
import { Threshold } from './threshold';

export interface Vector<T = any> {
  length: number;

  // Access the value by index (Like an array)
  [index: number]: T;

  // get(index: number): T;

  // Iterator: for(const val of v)
  [Symbol.iterator](): IterableIterator<T>;
}

export interface Field<T = any> {
  name: string; // The column name
  title?: string; // The display value for this field.  This supports template variables blank is auto
  type?: FieldType;
  filterable?: boolean;
  unit?: string;
  dateFormat?: string; // Source data format
  decimals?: number | null; // Significant digits (for display)
  min?: number | null;
  max?: number | null;

  // Convert input values into a display value
  mappings?: ValueMapping[];

  // Must be sorted by 'value', first value is always -Infinity
  thresholds?: Threshold[];

  // The actual values
  values: Vector<T>;
}

export interface DataFrame extends QueryResultBase {
  name?: string;
  labels?: Labels;
  fields: Field[];
}

export class ConstantVector<T> implements Vector<T> {
  [index: number]: T;

  constructor(private value: T, public length: number) {}

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.value;
    }
  }
}

// [Symbol.iterator]() {
//   return new ConstantIter<T>(this.value, this.length);
// }

// class ConstantIter<T> implements IterableIterator<T> {
//   private step = 0;

//   constructor(private value: T, public length: number) {}

//   public next(): IteratorResult<T> {
//     const done = ++this.step > this.length;
//     const res = { done, value: this.value };
//     console.log('ITER', this.step, res);
//     return res;
//   }

//   [Symbol.iterator](): IterableIterator<T> {
//     return this;
//   }
// }

/**
 * This object has a 'get' property for each field name
 * and can be accessed by column index
 */
export class RowCursor<T = any> implements IterableIterator<T> {
  cursor: number = 0;

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

  public next(): IteratorResult<T> {
    const len = this.fields[0].values.length;
    const done = this.cursor++ > len;
    return { done, value: (this as unknown) as T };
  }

  [Symbol.iterator](): IterableIterator<T> {
    this.cursor = 0; // reset to the beginning
    return this;
  }
}
