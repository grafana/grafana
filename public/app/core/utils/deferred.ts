export class Deferred<T = any> {
  resolve?: (reason: T | PromiseLike<T>) => void;
  reject?: (reason?: any) => void;
  promise: Promise<T>;

  constructor() {
    this.resolve = undefined;
    this.reject = undefined;

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    Object.freeze(this);
  }
}
