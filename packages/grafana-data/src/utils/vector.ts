import { Vector } from '../types/dataFrame';

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
    const arr: number[] = [];
    for (let i = 0; i < this.length; i++) {
      arr[i] = this.get(i);
    }
    return arr;
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

  toArray(): number[] {
    const arr: number[] = [];
    for (let i = 0; i < this.length; i++) {
      arr[i] = this.get(i);
    }
    return arr;
  }
}
