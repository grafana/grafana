declare var global: NodeJS.Global;

(<any>global).requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
};

