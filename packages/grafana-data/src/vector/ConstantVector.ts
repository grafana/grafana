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

  toArray(): T[] {
    const arr = new Array<T>(this.length);
    return arr.fill(this.value);
  }

  toJSON(): T[] {
    return this.toArray();
  }
}
