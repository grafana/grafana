/**
 * @public
 * @deprecated use a simple Arrays.  NOTE: Not used in grafana core.
 */
export class ConstantVector<T = any> extends Array<T> {
  constructor(value: T, len: number) {
    super();
    return new Array<T>(len).fill(value) as ConstantVector<T>;
  }
}
