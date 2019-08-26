import { Vector } from '../types/dataFrame';

export function vectorToArray<T>(v: Vector<T>): T[] {
  const arr: T[] = [];
  for (let i = 0; i < v.length; i++) {
    arr[i] = v.get(i);
  }
  return arr;
}

export class ArrayVector<T = any> implements Vector<T> {
  buffer: T[];

  constructor(buffer?: T[]) {
    this.buffer = buffer ? buffer : [];
  }

  get length() {
    return this.buffer.length;
  }

  get(index: number): T {
    return this.buffer[index];
  }

  toArray(): T[] {
    return this.buffer;
  }

  toJSON(): T[] {
    return this.buffer;
  }
}

export class ConstantVector<T = any> implements Vector<T> {
  constructor(private value: T, private len: number) {}

  get length() {
    return this.len;
  }

  get(index: number): T {
    return this.value;
  }

  toArray(): T[] {
    const arr: T[] = [];
    for (let i = 0; i < this.length; i++) {
      arr[i] = this.value;
    }
    return arr;
  }

  toJSON(): T[] {
    return this.toArray();
  }
}

export class ScaledVector implements Vector<number> {
  constructor(private source: Vector<number>, private scale: number) {}

  get length(): number {
    return this.source.length;
  }

  get(index: number): number {
    return this.source.get(index) * this.scale;
  }

  toArray(): number[] {
    return vectorToArray(this);
  }

  toJSON(): number[] {
    return vectorToArray(this);
  }
}

/**
 * Values are returned in the order defined by the input parameter
 */
export class SortedVector<T = any> implements Vector<T> {
  constructor(private source: Vector<T>, private order: number[]) {}

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
}

interface CircularOptions<T> {
  buffer?: T[];
  append?: 'head' | 'tail';
  capacity?: number;
}

/**
 * Circular vector uses a single buffer to capture a stream of values
 * overwriting the oldest value on add.
 *
 * This supports addting to the 'head' or 'tail' and will grow the buffer
 * to match a configured capacity.
 */
export class CircularVector<T = any> implements Vector<T> {
  private buffer: T[];
  private index: number;
  private capacity: number;
  private tail: boolean;

  constructor(options: CircularOptions<T>) {
    this.buffer = options.buffer || [];
    this.capacity = this.buffer.length;
    this.tail = 'head' !== options.append;
    this.index = 0;

    this.add = this.getAddFunction();
    if (options.capacity) {
      this.setCapacity(options.capacity);
    }
  }

  // Pick an add function that either writes forwards or backwards
  private getAddFunction() {
    return this.tail
      ? (value: T) => {
          this.buffer[this.index] = value;
          this.index = (this.index + 1) % this.buffer.length;
        }
      : (value: T) => {
          let idx = this.index - 1;
          if (idx < 0) {
            idx = this.buffer.length - 1;
          }
          this.buffer[idx] = value;
          this.index = idx;
        };
  }

  setCapacity(v: number) {
    if (this.capacity === v) {
      return;
    }
    // Make a copy so it is in order and new additions can be at the head or tail
    const copy = this.toArray();
    if (v > this.length) {
      this.buffer = copy;

      // Change the 'add' function so it actually appends
      this.add = this.tail
        ? (value: T) => {
            this.buffer.push(value);
            if (this.buffer.length >= this.capacity) {
              this.add = this.getAddFunction();
            }
          }
        : (value: T) => {
            this.buffer.unshift(value);
            if (this.buffer.length >= this.capacity) {
              this.add = this.getAddFunction();
            }
          };
    } else if (v < this.capacity) {
      // Shrink the buffer
      const delta = this.length - v;
      if (this.tail) {
        this.buffer = copy.slice(delta, copy.length); // Keep last items
      } else {
        this.buffer = copy.slice(0, copy.length - delta); // Keep first items
      }
    }
    this.capacity = v;
    this.index = 0;
  }

  /**
   * Add the value to the buffer
   */
  add: (value: T) => void;

  get(index: number) {
    return this.buffer[(index + this.index) % this.buffer.length];
  }

  get length() {
    return this.buffer.length;
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
    return vectorToArray(this);
  }
}
