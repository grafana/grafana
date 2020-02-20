export abstract class Vector<T = any> {
  // Default iterator, but can be overridden
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }

  abstract length: number;

  /**
   * Access the value by index (Like an array)
   */
  abstract get(index: number): T;

  /**
   * Get the results as an array.
   */
  abstract toArray(): T[];
}

/**
 * Apache arrow vectors are Read/Write
 */
export abstract class ReadWriteVector<T = any> extends Vector<T> {
  abstract set(index: number, value: T): void;
}

/**
 * Vector with standard manipulation functions
 */
export abstract class MutableVector<T = any> extends ReadWriteVector<T> {
  /**
   * Adds the value to the vector
   */
  abstract add(value: T): void;

  /**
   * modifies the vector so it is now the opposite order
   */
  abstract reverse(): void;
}
