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

  toJSON(): T[] {
    const arr: T[] = [];
    for (let i = 0; i < this.length; i++) {
      arr[i] = this.value;
    }
    return arr;
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

  toJSON(): number[] {
    return vectorToArray(this);
  }
}

export class CircularVector<T> implements Vector<T> {
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

  toJSON(): T[] {
    return vectorToArray(this);
  }
}

/**
 * Values are returned in the order defined by the input parameter
 */
export class SortedVector implements Vector<number> {
  constructor(private source: Vector<number>, private order: number[]) {}

  get length(): number {
    return this.source.length;
  }

  get(index: number): number {
    return this.source.get(this.order[index]);
  }

  toJSON(): number[] {
    return vectorToArray(this);
  }
}
