global.requestAnimationFrame = function (callback) {
    setTimeout(callback, 0);
};
Promise.prototype.finally = function (onFinally) {
    return this.then(
    /* onFulfilled */
    function (res) { return Promise.resolve(onFinally()).then(function () { return res; }); }, 
    /* onRejected */
    function (err) {
        return Promise.resolve(onFinally()).then(function () {
            throw err;
        });
    });
};
//# sourceMappingURL=jest-shim.js.map