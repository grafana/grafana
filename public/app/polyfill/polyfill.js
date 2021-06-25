MediaQueryList.prototype.addEventListener =
  MediaQueryList.prototype.addEventListener ??
  function (type, cb) {
    this.addListener(cb);
  };

MediaQueryList.prototype.removeEventListener =
  MediaQueryList.prototype.removeEventListener ??
  function (type, cb) {
    this.removeListener(cb);
  };
