import { makeArrayIndexableVector } from '../types';

import { FunctionalVector } from './FunctionalVector';

interface CircularOptions<T> {
  buffer?: T[];
  append?: 'head' | 'tail';
  capacity?: number;
}

/**
 * Circular vector uses a single buffer to capture a stream of values
 * overwriting the oldest value on add.
 *
 * This supports adding to the 'head' or 'tail' and will grow the buffer
 * to match a configured capacity.
 *
 * @public
 * @deprecated use a simple Arrays
 */
export class CircularVector<T = any> extends FunctionalVector<T> {
  private buffer: T[];
  private index: number;
  private capacity: number;
  private tail: boolean;

  constructor(options: CircularOptions<T>) {
    super();

    this.buffer = options.buffer || [];
    this.capacity = this.buffer.length;
    this.tail = 'head' !== options.append;
    this.index = 0;

    this.add = this.getAddFunction();
    if (options.capacity) {
      this.setCapacity(options.capacity);
    }
    return makeArrayIndexableVector(this);
  }

  /**
   * This gets the appropriate add function depending on the buffer state:
   *  * head vs tail
   *  * growing buffer vs overwriting values
   */
  private getAddFunction(): (value: T) => void {
    // When we are not at capacity, it should actually modify the buffer
    if (this.capacity > this.buffer.length) {
      if (this.tail) {
        return (value: T) => {
          this.buffer.push(value);
          if (this.buffer.length >= this.capacity) {
            this.add = this.getAddFunction();
          }
        };
      } else {
        return (value: T) => {
          this.buffer.unshift(value);
          if (this.buffer.length >= this.capacity) {
            this.add = this.getAddFunction();
          }
        };
      }
    }

    if (this.tail) {
      return (value: T) => {
        this.buffer[this.index] = value;
        this.index = (this.index + 1) % this.buffer.length;
      };
    }

    // Append values to the head
    return (value: T) => {
      let idx = this.index - 1;
      if (idx < 0) {
        idx = this.buffer.length - 1;
      }
      this.buffer[idx] = value;
      this.index = idx;
    };
  }

  setCapacity(v: number) {
    if (this.capacity === v) {
      return;
    }
    // Make a copy so it is in order and new additions can be at the head or tail
    const copy = this.toArray();
    if (v > this.length) {
      this.buffer = copy;
    } else if (v < this.capacity) {
      // Shrink the buffer
      const delta = this.length - v;
      if (this.tail) {
        this.buffer = copy.slice(delta, copy.length); // Keep last items
      } else {
        this.buffer = copy.slice(0, copy.length - delta); // Keep first items
      }
    }
    this.capacity = v;
    this.index = 0;
    this.add = this.getAddFunction();
  }

  setAppendMode(mode: 'head' | 'tail') {
    const tail = 'head' !== mode;
    if (tail !== this.tail) {
      this.buffer = this.toArray().reverse();
      this.index = 0;
      this.tail = tail;
      this.add = this.getAddFunction();
    }
  }

  reverse() {
    return this.buffer.reverse();
  }

  get(index: number) {
    return this.buffer[(index + this.index) % this.buffer.length];
  }

  set(index: number, value: any) {
    this.buffer[(index + this.index) % this.buffer.length] = value;
  }

  get length() {
    return this.buffer.length;
  }
}
