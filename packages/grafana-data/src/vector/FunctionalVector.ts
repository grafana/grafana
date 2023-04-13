import { Vector } from '../types';

import { vectorToArray } from './vectorToArray';

/** @public */
export abstract class FunctionalVector<T = any> implements Vector<T> {
  abstract get length(): number;

  abstract get(index: number): T;

  // Implement "iterator protocol"
  *iterator() {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }

  set(index: number, value: any): void {
    throw 'unsupported operation';
  }

  add(value: T): void {
    throw 'unsupported operation';
  }

  push(...vals: T[]): number {
    for (const v of vals) {
      this.add(v);
    }
    return this.length;
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

  at(index: number): T | undefined {
    return this.get(index);
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  join(separator?: string | undefined): string {
    return this.toArray().join(separator);
  }

  toJSON(): any {
    return this.toArray();
  }

  //--------------------------
  // Method not implemented
  //--------------------------

  [n: number]: T;

  pop(): T | undefined {
    throw new Error('Method not implemented.');
  }
  concat(...items: Array<ConcatArray<T>>): T[];
  concat(...items: Array<T | ConcatArray<T>>): T[] {
    throw new Error('Method not implemented.');
  }
  reverse(): T[] {
    throw new Error('Method not implemented.');
  }
  shift(): T | undefined {
    throw new Error('Method not implemented.');
  }
  slice(start?: number | undefined, end?: number | undefined): T[] {
    throw new Error('Method not implemented.');
  }
  sort(compareFn?: ((a: T, b: T) => number) | undefined): this {
    throw new Error('Method not implemented.');
  }
  splice(start: number, deleteCount?: number | undefined): T[];
  splice(start: number, deleteCount: number, ...items: T[]): T[] {
    throw new Error('Method not implemented.');
  }
  unshift(...items: T[]): number {
    throw new Error('Method not implemented.');
  }
  indexOf(searchElement: T, fromIndex?: number | undefined): number {
    throw new Error('Method not implemented.');
  }
  lastIndexOf(searchElement: T, fromIndex?: number | undefined): number {
    throw new Error('Method not implemented.');
  }
  every<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[];
  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
  every(predicate: unknown, thisArg?: unknown): boolean {
    throw new Error('Method not implemented.');
  }
  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    throw new Error('Method not implemented.');
  }
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T;
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  reduce(callbackfn: unknown, initialValue?: unknown): T {
    throw new Error('Method not implemented.');
  }
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduceRight(
    callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T,
    initialValue: T
  ): T;
  reduceRight<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U,
    initialValue: U
  ): U;
  reduceRight(callbackfn: unknown, initialValue?: unknown): T {
    throw new Error('Method not implemented.');
  }
  find<S extends T>(
    predicate: (this: void, value: T, index: number, obj: T[]) => value is S,
    thisArg?: any
  ): S | undefined;
  find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
  find(predicate: unknown, thisArg?: unknown): T | undefined {
    throw new Error('Method not implemented.');
  }
  findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number {
    throw new Error('Method not implemented.');
  }
  fill(value: T, start?: number | undefined, end?: number | undefined): this {
    throw new Error('Method not implemented.');
  }
  copyWithin(target: number, start: number, end?: number | undefined): this {
    throw new Error('Method not implemented.');
  }
  entries(): IterableIterator<[number, T]> {
    return this.toArray().entries();
  }
  keys(): IterableIterator<number> {
    return this.toArray().keys();
  }
  values(): IterableIterator<T> {
    return this.toArray().values();
  }
  includes(searchElement: T, fromIndex?: number | undefined): boolean {
    return this.toArray().includes(searchElement, fromIndex);
  }
  flatMap<U, This = undefined>(
    callback: (this: This, value: T, index: number, array: T[]) => U | readonly U[],
    thisArg?: This | undefined
  ): U[] {
    throw new Error('Method not implemented.');
  }
  flat<A, D extends number = 1>(this: A, depth?: D | undefined): Array<FlatArray<A, D>> {
    throw new Error('Method not implemented.');
  }
  [Symbol.unscopables](): {
    copyWithin: boolean;
    entries: boolean;
    fill: boolean;
    find: boolean;
    findIndex: boolean;
    keys: boolean;
    values: boolean;
  } {
    throw new Error('Method not implemented.');
  }
}

const emptyarray: any[] = [];

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
        iterator(vector.get(i), i, emptyarray);
      }
    },

    map<V>(transform: (item: T, index: number, array: T[]) => V): V[] {
      const result: V[] = [];
      for (let i = 0; i < vector.length; i++) {
        result.push(transform(vector.get(i), i, emptyarray));
      }
      return result;
    },

    /** Add a predicate where you return true if it should *keep* the value */
    filter(predicate: (item: T, index: number, array: T[]) => boolean): T[] {
      const result: T[] = [];
      let count = 0;
      for (const val of this) {
        if (predicate(val, count++, emptyarray)) {
          result.push(val);
        }
      }
      return result;
    },
  };
}
