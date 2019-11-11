import { MutableVector } from '../types/vector';

export class ArrayVector<T = any> implements MutableVector<T> {
  buffer: T[];

  constructor(buffer?: T[]) {
    this.buffer = buffer ? buffer : [];
  }

  get length() {
    return this.buffer.length;
  }

  add(value: T) {
    this.buffer.push(value);
  }

  get(index: number): T {
    return this.buffer[index];
  }

  set(index: number, value: T) {
    this.buffer[index] = value;
  }

  reverse() {
    this.buffer.reverse();
  }

  toArray(): T[] {
    return this.buffer;
  }

  toJSON(): T[] {
    return this.buffer;
  }
}
