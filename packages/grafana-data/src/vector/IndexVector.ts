import { Field, FieldType } from '../types';
import { FunctionalVector } from './FunctionalVector';

/**
 * IndexVector is a simple vector implementation that returns the index value
 * for each element in the vector.  It is functionally equivolant a vector backed
 * by an array with values: `[0,1,2,...,length-1]`
 */
export class IndexVector extends FunctionalVector<number> {
  constructor(private len: number) {
    super();
  }

  get length() {
    return this.len;
  }

  get(index: number): number {
    return index;
  }

  /**
   * Returns a field representing the range [0 ... length-1]
   */
  static newField(len: number): Field<number> {
    return {
      name: '',
      values: new IndexVector(len),
      type: FieldType.number,
      config: {
        min: 0,
        max: len - 1,
      },
    };
  }
}
