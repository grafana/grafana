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
    const arr = new Array<T>(this.length);
    return arr.fill(this.value);
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

  /**
   * This gets the appropriate add function depending on the buffer state:
   *  * head vs tail
   *  * growing buffer vs overwriting values
   */
  private getAddFunction() {
    // When we are not at capacity, it should actually modify the buffer
    if (this.capacity > this.buffer.length) {
      if (this.tail) {
        return (value: T) => {
          this.buffer.push(value);
          if (this.buffer.length >= this.capacity) {
            this.add = this.getAddFunction();
          }
        };
      } else {
        return (value: T) => {
          this.buffer.unshift(value);
          if (this.buffer.length >= this.capacity) {
            this.add = this.getAddFunction();
          }
        };
      }
    }

    if (this.tail) {
      return (value: T) => {
        this.buffer[this.index] = value;
        this.index = (this.index + 1) % this.buffer.length;
      };
    }

    // Append values to the head
    return (value: T) => {
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
    this.add = this.getAddFunction();
  }

  setAppendMode(mode: 'head' | 'tail') {
    const tail = 'head' !== mode;
    if (tail !== this.tail) {
      this.buffer = this.toArray().reverse();
      this.index = 0;
      this.tail = tail;
      this.add = this.getAddFunction();
    }
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

interface AppendedVectorInfo<T> {
  start: number;
  end: number;
  values: Vector<T>;
}

/**
 * This may be more trouble than it is worth.  This trades some computation time for
 * RAM -- rather than allocate a new array the size of all previous arrays, this just
 * points the correct index to their original array values
 */
export class AppendedVectors<T = any> implements Vector<T> {
  length = 0;
  source: Array<AppendedVectorInfo<T>> = new Array<AppendedVectorInfo<T>>();

  constructor(startAt = 0) {
    this.length = startAt;
  }

  /**
   * Make the vector look like it is this long
   */
  setLength(length: number) {
    if (length > this.length) {
      // make the vector longer (filling with undefined)
      this.length = length;
    } else if (length < this.length) {
      // make the array shorter
      const sources: Array<AppendedVectorInfo<T>> = new Array<AppendedVectorInfo<T>>();
      for (const src of this.source) {
        sources.push(src);
        if (src.end > length) {
          src.end = length;
          break;
        }
      }
      this.source = sources;
      this.length = length;
    }
  }

  append(v: Vector<T>): AppendedVectorInfo<T> {
    const info = {
      start: this.length,
      end: this.length + v.length,
      values: v,
    };
    this.length = info.end;
    this.source.push(info);
    return info;
  }

  get(index: number): T {
    for (let i = 0; i < this.source.length; i++) {
      const src = this.source[i];
      if (index >= src.start && index < src.end) {
        return src.values.get(index - src.start);
      }
    }
    return (undefined as unknown) as T;
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
    return vectorToArray(this);
  }
}
