import { MutableVector } from '../types/vector';

import { FunctionalVector } from './FunctionalVector';

/**
 * @public
 */
export class ArrayVector<T = any> extends FunctionalVector<T> implements MutableVector<T> {
  buffer: T[];

  constructor(buffer?: T[]) {
    super();
    this.buffer = buffer ? buffer : [];
  }

  get length() {
    return this.buffer.length;
  }

  add(value: T) {
    this.buffer.push(value);
  }

  get(index: number): T {
    return this.buffer[index];
  }

  set(index: number, value: T) {
    this.buffer[index] = value;
  }

  reverse() {
    this.buffer.reverse();
  }

  toArray(): T[] {
    return this.buffer;
  }

  toJSON(): T[] {
    return this.buffer;
  }
}

/*
// WIP polyfill for replacing ArrayVector() with a plain array
// https://jsfiddle.net/7gfwqrmt/1/
// TODO: typings kung fu

// JS original sin
Object.assign(Array.prototype, {
	get(idx) {
    return this[idx];
  },
  set(idx, value) {
  	this[idx] = value;
  },
  add(value) {
  	this.push(value);
  },
  get(idx) {
  	return this[idx];
  },
  toArray() {
  	return this;
  },
  toJSON() {
  	return this;
  }
});

Object.defineProperty(Array.prototype, 'buffer', {
	get: function() { return this; }
});

let notified = false;
let notice = "ArrayVector is deprecated and will be removed in Grafana 9. Please migrate to plain arrays for field.values."

function ArrayVector(arr) {
	if (!notified) {
  	console.error(notice);
  	notified = true;
  }
  return arr || [];
}


let arv = new ArrayVector([12,13,14]);

console.log(arv);
console.log(arv.get(0));
console.log(arv.buffer);
console.log(Array.isArray(arv));
console.log(arv.slice());
*/
