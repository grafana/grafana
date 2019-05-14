// https://github.com/facebook/react/issues/5465
export var makePromiseCancelable = function (promise) {
    var hasCanceled_ = false;
    var wrappedPromise = new Promise(function (resolve, reject) {
        promise.then(function (val) { return (hasCanceled_ ? reject({ isCanceled: true }) : resolve(val)); });
        promise.catch(function (error) { return (hasCanceled_ ? reject({ isCanceled: true }) : reject(error)); });
    });
    return {
        promise: wrappedPromise,
        cancel: function () {
            hasCanceled_ = true;
        },
    };
};
//# sourceMappingURL=CancelablePromise.js.map