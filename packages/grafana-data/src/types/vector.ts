export interface Vector<T = any> extends Array<T> {
  length: number;

  /**
   * Access the value by index (Like an array)
   */
  get(index: number): T;

  /**
   * Set a value
   */
  set: (index: number, value: T) => void;

  /**
   * Adds the value to the vector
   * Same as Array.push()
   */
  add: (value: T) => void;

  /**
   * Get the results as an array.
   */
  toArray(): T[];
}

/**
 * Apache arrow vectors are Read/Write
 *
 * @deprecated -- this is now part of the base Vector interface
 */
export interface ReadWriteVector<T = any> extends Vector<T> {}

/**
 * Vector with standard manipulation functions
 *
 * @deprecated -- this is now part of the base Vector interface
 */
export interface MutableVector<T = any> extends ReadWriteVector<T> {}
