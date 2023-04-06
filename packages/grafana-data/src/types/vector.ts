// WIP polyfill for replacing ArrayVector() with a plain array
// https://jsfiddle.net/Lbj7co84/
// TODO: typings kung fu

declare global {
  interface Array<T> {
    /** @deprecated used to migrate Vector to array */
    get(idx: number): T;
    /** @deprecated used to migrate Vector to array */
    set(idx: number, value: T): void;
    /** @deprecated used to migrate Vector to array */
    add(value: T): void;
    /** @deprecated used to migrate Vector to array */
    toArray(): T[];
  }
}

// JS original sin
Object.assign(Array.prototype, {
  get(idx: number): any {
    return (this as any)[idx];
  },
  set(idx: number, value: any) {
    (this as any)[idx] = value;
  },
  add(value: any) {
    (this as any).push(value);
  },
  toArray() {
    return this;
  },
});

/** @deprecated use a simple Array<T> */
export interface Vector<T = any> {
  length: number;

  /**
   * Access the value by index (Like an array)
   */
  get(index: number): T;

  /**
   * Get the results as an array.
   */
  toArray(): T[];

  /** Support array style map functions */
  map<V>(transform: (item: T, index: number) => V): V[];

  /** Support array style forEach */
  forEach(iterator: (row: T) => void): void;

  /** Support array style filter */
  filter(predicate: (item: T) => boolean): T[];

  /** Allow using spread operators on values */
  [Symbol.iterator](): IterableIterator<T>;
}

/**
 * Apache arrow vectors are Read/Write
 */
export interface ReadWriteVector<T = any> extends Vector<T> {
  set: (index: number, value: T) => void;
}

/**
 * Vector with standard manipulation functions
 */
export interface MutableVector<T = any> extends ReadWriteVector<T> {
  /**
   * Adds the value to the vector
   */
  add: (value: T) => void;

  /**
   * modifies the vector so it is now the opposite order
   */
  reverse: () => void;
}
