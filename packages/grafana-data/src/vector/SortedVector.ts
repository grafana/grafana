import { Vector } from '../types/vector';

import { FunctionalVector } from './FunctionalVector';
import { vectorToArray } from './vectorToArray';

/**
 * Values are returned in the order defined by the input parameter
 *
 * @deprecated use a simple Arrays
 */
export class SortedVector<T = any> extends FunctionalVector<T> {
  constructor(private source: Vector<T>, private order: number[]) {
    super();
  }

  get length(): number {
    return this.source.length;
  }

  get(index: number): T {
    return this.source.get(this.order[index]);
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
    return vectorToArray(this);
  }

  getOrderArray(): number[] {
    return this.order;
  }
}
