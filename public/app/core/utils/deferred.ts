export class Deferred {
  resolve: any;
  reject: any;
  promise: Promise<any>;
  constructor() {
    this.resolve = null;
    this.reject = null;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    Object.freeze(this);
  }
}
