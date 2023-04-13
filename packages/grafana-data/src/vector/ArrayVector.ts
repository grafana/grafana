/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> {
  buffer: T[];

  // This constructor needs to accept any otherwise the value takes over the definition
  constructor(buffer?: any[]) {
    super();
    this.buffer = buffer ? buffer : [];
  }

  get length() {
    return this.buffer.length;
  }

  add(value: T): void {
    this.buffer.push(value);
  }

  get(index: number): T {
    return this.buffer[index];
  }

  set(index: number, value: T) {
    this.buffer[index] = value;
  }

  /** support standard array push syntax */
  push(...vals: T[]): number {
    return this.buffer.push(...vals);
  }

  reverse() {
    return this.buffer.reverse();
  }

  toArray(): T[] {
    return this.buffer;
  }

  toJSON(): T[] {
    return this.buffer;
  }
}
