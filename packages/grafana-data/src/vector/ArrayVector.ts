import { Vector } from '../types';

/**
 * @public
 *
 * @deprecated use a simple Array<T>
 */
export class ArrayVector<T = any> extends Array<T> implements Vector<T> {
  constructor(buffer?: T[]) {
    super();

    if (buffer?.length) {
      this.buffer = buffer;
    }
  }

  get buffer() {
    return this as T[];
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
}
