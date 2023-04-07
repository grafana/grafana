import { Vector } from '../types/vector';

import { FunctionalVector } from './FunctionalVector';
import { vectorToArray } from './vectorToArray';

interface AppendedVectorInfo<T> {
  start: number;
  end: number;
  values: Vector<T>;
}

/**
 * This may be more trouble than it is worth.  This trades some computation time for
 * RAM -- rather than allocate a new array the size of all previous arrays, this just
 * points the correct index to their original array values
 *
 * @deprecated -- this approach is really too complicated for its own good (and not used anywhere)
 */
export class AppendedVectors<T = any> extends FunctionalVector<T> {
  length = 0;
  source: Array<AppendedVectorInfo<T>> = [];

  constructor(startAt = 0) {
    super();
    this.length = startAt;
  }

  /**
   * Make the vector look like it is this long
   */
  setLength(length: number) {
    if (length > this.length) {
      // make the vector longer (filling with undefined)
      this.length = length;
    } else if (length < this.length) {
      // make the array shorter
      const sources: Array<AppendedVectorInfo<T>> = [];
      for (const src of this.source) {
        sources.push(src);
        if (src.end > length) {
          src.end = length;
          break;
        }
      }
      this.source = sources;
      this.length = length;
    }
  }

  append(v: Vector<T>): AppendedVectorInfo<T> {
    const info = {
      start: this.length,
      end: this.length + v.length,
      values: v,
    };
    this.length = info.end;
    this.source.push(info);
    return info;
  }

  get(index: number): T {
    for (let i = 0; i < this.source.length; i++) {
      const src = this.source[i];
      if (index >= src.start && index < src.end) {
        return src.values.get(index - src.start);
      }
    }
    return undefined as unknown as T;
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
    return vectorToArray(this);
  }
}
