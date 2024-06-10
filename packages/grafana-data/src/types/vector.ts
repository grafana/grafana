declare global {
  interface Array<T> {
    /** @deprecated Use [idx]. This only exists to help migrate Vector to Array */
    get(idx: number): T;
    /** @deprecated Use [idx]. This only exists to help migrate Vector to Array */
    set(idx: number, value: T): void;
    /** @deprecated Use .push(value). This only exists to help migrate Vector to Array */
    add(value: T): void;
    /** @deprecated this is not necessary.  This only exists to help migrate Vector to Array */
    toArray(): T[];
  }
}

// JS original sin
// this if condition is because Jest will re-exec this block multiple times (in a browser this only runs once)
export function patchArrayVectorProrotypeMethods() {
  if (!Object.getOwnPropertyDescriptor(Array.prototype, 'toArray')) {
    Object.defineProperties(Array.prototype, {
      get: {
        value: function (idx: number) {
          return this[idx];
        },
        writable: true,
        enumerable: false,
        configurable: true,
      },
      set: {
        value: function (idx: number, value: unknown) {
          this[idx] = value;
        },
        writable: true,
        enumerable: false,
        configurable: true,
      },
      add: {
        value: function (value: unknown) {
          this.push(value);
        },
        writable: true,
        enumerable: false,
        configurable: true,
      },
      toArray: {
        value: function () {
          return this;
        },
        writable: true,
        enumerable: false,
        configurable: true,
      },
    });
  }
}
//this function call is intentional
patchArrayVectorProrotypeMethods();
