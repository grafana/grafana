declare var global: NodeJS.Global;

(global as any).requestAnimationFrame = (callback: any) => {
  setTimeout(callback, 0);
};

(Promise.prototype as any).finally = function(onFinally: any) {
  return this.then(
    /* onFulfilled */
    (res: any) => Promise.resolve(onFinally()).then(() => res),
    /* onRejected */
    (err: any) =>
      Promise.resolve(onFinally()).then(() => {
        throw err;
      })
  );
};
