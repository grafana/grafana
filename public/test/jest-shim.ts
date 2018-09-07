declare var global: NodeJS.Global;

(global as any).requestAnimationFrame = callback => {
  setTimeout(callback, 0);
};

(Promise.prototype as any).finally = function(onFinally) {
  return this.then(
    /* onFulfilled */
    res => Promise.resolve(onFinally()).then(() => res),
    /* onRejected */
    err =>
      Promise.resolve(onFinally()).then(() => {
        throw err;
      })
  );
};
