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
    return vectorator(this).forEach(iterator);
  }

  map<V>(transform: (item: T, index: number) => V) {
    return vectorator(this).map(transform);
  }

  filter<V>(predicate: (item: T) => V) {
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

    forEach(iterator: (row: T) => void) {
      for (let i = 0; i < vector.length; i++) {
        iterator(vector.get(i));
      }
    },

    map<V>(transform: (item: T, index: number) => V) {
      const result: V[] = [];
      for (let i = 0; i < vector.length; i++) {
        result.push(transform(vector.get(i), i));
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
