import { vectorToArray } from './vectorToArray';
import { Vector } from '../types';

export abstract class FunctionalVector<T = any> implements Vector<T>, Iterable<T> {
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

  forEach(iterator: (row: T) => void) {
    for (let i = 0; i < this.length; i++) {
      iterator(this.get(i));
    }
  }

  map<V>(iterator: (item: T, index: number) => V) {
    const acc: V[] = [];
    for (let i = 0; i < this.length; i++) {
      acc.push(iterator(this.get(i), i));
    }
    return acc;
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

    map<V>(transform: (item: T) => V) {
      const result: V[] = [];
      for (const val of this) {
        result.push(transform(val));
      }
      return result;
    },

    filter<V>(predicate: (item: T) => V) {
      const result: T[] = [];
      for (const val of this) {
        if (predicate(val)) {
          result.push(val);
        }
      }
      return result;
    },
  };
}
