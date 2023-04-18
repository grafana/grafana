/**
 * @public
 * @deprecated use a simple Arrays
 */
export class ConstantVector<T = any> extends Array<T> {
  constructor(value: T, len: number) {
    super();
    return new Array<T>(len).fill(value) as ConstantVector<T>;
  }
}
