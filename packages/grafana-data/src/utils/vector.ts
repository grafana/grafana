import { Vector } from '../types/dataFrame';

export class ArrayVector<T = any> implements Vector<T> {
  buffer: T[];

  constructor(buffer?: T[]) {
    this.buffer = buffer ? buffer : [];
  }

  getLength() {
    return this.buffer.length;
  }

  get(index: number): T {
    return this.buffer[index];
  }
}

export class ConstantVector<T = any> implements Vector<T> {
  constructor(private value: T, private length: number) {}

  getLength() {
    return this.length;
  }

  get(index: number): T {
    return this.value;
  }
}

export class ScaledVector implements Vector<number> {
  constructor(private source: Vector<number>, private scale: number) {}

  getLength(): number {
    return this.source.getLength();
  }

  get(index: number): number {
    return this.source.get(index) * this.scale;
  }
}
