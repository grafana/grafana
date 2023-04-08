import { Vector } from '../types';

import { vectorToArray } from './vectorToArray';

/** @public */
export abstract class FunctionalVector<T = any> extends Array<T> implements Vector<T> {
  abstract get length(): number;

  abstract get(index: number): T;

  // Implement "iterator protocol"
  *iterator() {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }

  // Implement "iterable protocol"
  [Symbol.iterator]() {
    return this.iterator();
  }

  forEach(iterator: (row: T, index: number, array: T[]) => void): void {
    return vectorator(this).forEach(iterator);
  }

  map<V>(transform: (item: T, index: number, array: T[]) => V): V[] {
    return vectorator(this).map(transform);
  }

  filter(predicate: (item: T, index: number, array: T[]) => boolean): T[] {
    return vectorator(this).filter(predicate);
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): any {
    return this.toArray();
  }
}

/**
 * Use functional programming with your vector
 */
export function vectorator<T>(vector: Vector<T>) {
  return {
    *[Symbol.iterator]() {
      for (let i = 0; i < vector.length; i++) {
        yield vector.get(i);
      }
    },

    forEach(iterator: (row: T, index: number, array: T[]) => void): void {
      for (let i = 0; i < vector.length; i++) {
        iterator(vector.get(i), i, []);
      }
    },

    map<V>(transform: (item: T, index: number, array: T[]) => V): V[] {
      const result: V[] = [];
      for (let i = 0; i < vector.length; i++) {
        result.push(transform(vector.get(i), i, []));
      }
      return result;
    },

    /** Add a predicate where you return true if it should *keep* the value */
    filter(predicate: (item: T, index: number, array: T[]) => boolean): T[] {
      const result: T[] = [];
      let count = 0;
      for (const val of this) {
        if (predicate(val, count++, [])) {
          result.push(val);
        }
      }
      return result;
    },
  };
}
