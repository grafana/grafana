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

export class CircularVector<T = any> implements Vector<T> {
  buffer: T[];
  index: number;
  length: number;

  constructor(buffer: T[]) {
    this.length = buffer.length;
    this.buffer = buffer;
    this.index = 0;
  }

  append(value: T) {
    let idx = this.index - 1;
    if (idx < 0) {
      idx = this.length - 1;
    }
    this.buffer[idx] = value;
    this.index = idx;
  }

  get(index: number): T {
    return this.buffer[(index + this.index) % this.length];
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
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
