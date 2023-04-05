import { MutableVector } from '../types/vector';

// WIP polyfill for replacing ArrayVector() with a plain array
// https://jsfiddle.net/Lbj7co84/
// TODO: typings kung fu

// JS original sin
Object.assign(Array.prototype, {
  get(idx: string | number): any {
    return (this as any)[idx];
  },
  set(idx: string | number, value: any) {
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
});

let notified = false;
let notice =
  'ArrayVector is deprecated and will be removed in Grafana 9. Please migrate to plain arrays for field.values.';

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

/**
 * @public
 */
export class ArrayVector<T = any> extends Array<T> implements MutableVector<T> {
  // eslint-ignore-next-line
  // buffer: T[];

  constructor(buffer?: T[]) {
    super();

    if (!notified) {
      console.error(notice);
      notified = true;
    }
    return (buffer ?? []) as unknown as ArrayVector<T>;
  }

  add(value: T) {
    throw 'not used';
  }

  get(index: number): T {
    throw 'not used';
  }

  set(index: number, value: T) {
    throw 'not used';
  }

  toArray(): T[] {
    throw 'not used';
  }

  toJSON(): T[] {
    throw 'not used';
  }
}
