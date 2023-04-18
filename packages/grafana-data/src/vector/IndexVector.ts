import { Field, FieldType } from '../types';

/**
 * IndexVector is a simple vector implementation that returns the index value
 * for each element in the vector.  It is functionally equivolant a vector backed
 * by an array with values: `[0,1,2,...,length-1]`
 *
 * @deprecated use a simple Arrays
 */
export class IndexVector extends Array<number> {
  constructor(len: number) {
    super();
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = i;
    }
    return arr as IndexVector;
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
