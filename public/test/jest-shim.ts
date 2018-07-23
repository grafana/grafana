declare var global: NodeJS.Global;

(<any>global).requestAnimationFrame = callback => {
  setTimeout(callback, 0);
};

(<any>Promise.prototype).finally = function(onFinally) {
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
