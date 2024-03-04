const notice = 'ArrayVector is deprecated and will be removed in Grafana 11. Please use plain arrays for field.values.';
let notified = false;

/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = unknown> extends Array<T> {
  get buffer() {
    return this;
  }

  set buffer(values: T[]) {
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

  /**
   * ArrayVector is deprecated and should not be used. If you get a Typescript error here, use plain arrays for field.values.
   */
  // `never` is used to force a build-type error from Typescript to encourage developers to move away from using this
  constructor(buffer: never) {
    super();
    this.buffer = buffer ?? [];

    if (!notified) {
      console.warn(notice);
      notified = true;
    }
  }

  toJSON(): T[] {
    return [...this]; // copy to avoid circular reference (only for jest)
  }
}
