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
