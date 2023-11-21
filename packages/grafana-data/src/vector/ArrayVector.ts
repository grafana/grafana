const notice = 'ArrayVector is deprecated and will be removed in Grafana 11. Please use plain arrays for field.values.';
let notified = false;

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

  /**
   * This any type is here to make the change type changes in v10 non breaking for plugins.
   * Before you could technically assign field.values any typed ArrayVector no matter what the Field<T> T type was.
   */
  constructor(buffer?: any[]) {
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
