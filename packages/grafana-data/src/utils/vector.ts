import { Vector } from '../types/dataFrame';

export class ConstantVector<T = any> implements Vector<T> {
  constructor(private value: T, public length: number) {}

  get(index: number): T {
    return this.value;
  }

  [index: number]: T; // IMPLEMENT with proxy?

  // Ignor the input items
  push(...items: T[]): number {
    return this.length;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.value;
    }
  }
}
