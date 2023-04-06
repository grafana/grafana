import { Vector } from '../types';

/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> implements Vector {
  constructor(buffer?: T[]) {
    super();

    if (buffer?.length) {
      this.buffer = buffer;
    }
  }

  get buffer() {
    return this as T[];
  }

  set buffer(values: T[]) {
    this.length = 0;
    if (values?.length) {
      this.push(...values);
      // for (let i = 0; i < values.length; i++) {
      //   this.push(values[i]);
      // }
    }
  }
}
