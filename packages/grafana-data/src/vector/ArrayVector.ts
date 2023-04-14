/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> {
  get buffer() {
    return this;
  }

  set buffer(values: any[]) {
    this.length = 0;

    const len = values?.length;

    if (len) {
      let chonkSize = 65e3;
      let numChonks = Math.ceil(len / chonkSize);

      for (let chonkIdx = 0; chonkIdx < numChonks; chonkIdx++) {
        this.push.apply(this, values.slice(chonkIdx * chonkSize, (chonkIdx + 1) * chonkSize));
      }
    }
  }

  constructor(buffer?: T[]) {
    super();
    this.buffer = buffer ?? [];
  }

  toJSON(): T[] {
    return [...this]; // copy to avoid circular reference (only for jest)
  }
}
