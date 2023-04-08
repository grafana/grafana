import { FunctionalVector } from './FunctionalVector';

/**
 * @public
 */
export class ConstantVector<T = any> extends FunctionalVector<T> {
  constructor(private value: T, private len: number) {
    super();
  }

  get length() {
    return this.len;
  }

  get(index: number): T {
    return this.value;
  }

  push(...vals: T[]): void {
    throw 'unsupported operation';
  }

  toArray(): T[] {
    const arr = new Array<T>(this.length);
    return arr.fill(this.value);
  }

  toJSON(): T[] {
    return this.toArray();
  }
}
