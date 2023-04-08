declare global {
  interface Array<T> {
    /** @deprecated this only exists to help migrate Vector to Array */
    get(idx: number): T;
    /** @deprecated this only exists to help migrate Vector to Array */
    set(idx: number, value: T): void;
    /** @deprecated this only exists to help migrate Vector to Array */
    add(value: T): void;
    /** @deprecated this only exists to help migrate Vector to Array */
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
export interface Vector<T = any> extends Array<T> {
  length: number;

  /**
   * Access the value by index (Like an array)
   */
  get(index: number): T;

  /**
   * Get the results as an array.
   */
  toArray(): T[];
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
}
