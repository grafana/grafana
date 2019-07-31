import { Vector } from '../types/dataFrame';

export class ConstantVector<T = any> implements Vector<T> {
  constructor(private value: T, public length: number) {}

  get(index: number): T {
    return this.value;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.value;
    }
  }
}

export class ArrayVector<T = any> implements Vector<T> {
  constructor(public buffer: T[]) {}

  get length() {
    return this.buffer.length;
  }

  get(index: number): T {
    return this.buffer[index];
  }

  [Symbol.iterator]() {
    return this.buffer.values();
  }
}
