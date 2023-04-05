import { MutableVector } from '../types/vector';

// WIP polyfill for replacing ArrayVector() with a plain array
// https://jsfiddle.net/Lbj7co84/
// TODO: typings kung fu

declare global {
  interface Array<T> {
    get buffer(): T[];
    set buffer(value: T[]);
    get(idx: number): T;
    set(idx: number, value: T): void;
    add(value: T): void;
    toArray(): T[];
    toJSON(): string;
  }
}

// JS original sin
Object.assign(Array.prototype, {
  get(idx: number): any {
    return (this as any)[idx];
  },
  set(idx: number, value: any) {
    (this as any)[idx] = value;
  },
  add(value: any) {
    (this as any).push(value);
  },
  toArray() {
    return this;
  },
  toJSON() {
    return this;
  },
});

Object.defineProperty(Array.prototype, 'buffer', {
  get: function () {
    return this;
  },
  set: function () {},
});

let notified = false;
let notice = 'ArrayVector is deprecated and will be removed in Grafana 11. Please use plain arrays for field.values.';

/*
function ArrayVector(arr) {
  if (!notified) {
    console.error(notice);
    notified = true;
  }
  return arr ?? [];
}

let arv = new ArrayVector([12, 13, 14]);

console.log(arv);
console.log(arv.get(0));
console.log(arv.buffer);
console.log(Array.isArray(arv));
console.log(arv.slice());
*/

const unused = 'not used';

/**
 * @public
 */
export class ArrayVector<T = any> extends Array<T> implements MutableVector<T> {
  buffer: T[];

  constructor(buffer: T[] = []) {
    super();

    if (!notified) {
      console.error(notice);
      notified = true;
    }

    this.buffer = buffer;

    return buffer as unknown as ArrayVector<T>;
  }

  add(value: T) {
    throw unused;
  }

  get(index: number): T {
    throw unused;
  }

  set(index: number, value: T) {
    throw unused;
  }

  toArray(): T[] {
    throw unused;
  }

  toJSON(): string {
    throw unused;
  }
}
