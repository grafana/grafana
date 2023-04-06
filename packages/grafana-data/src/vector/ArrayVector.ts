import { Vector } from '../types';

/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> implements Vector {
  // // built-in methods will use this as the constructor
  // static get [Symbol.species]() {
  //   return Array;
  // }

  constructor(buffer?: T[]) {
    super();

    if (buffer) {
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
    }
  }
}

/*
let arv = new ArrayVector([12, 13, 14]);

console.log(arv);
console.log(arv.get(0));
console.log(arv.buffer);
console.log(Array.isArray(arv));
console.log(arv.slice());
*/
