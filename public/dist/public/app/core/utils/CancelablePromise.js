// https://github.com/facebook/react/issues/5465
export function isCancelablePromiseRejection(promise) {
    return typeof promise === 'object' && promise !== null && 'isCanceled' in promise;
}
export const makePromiseCancelable = (promise) => {
    let hasCanceled_ = false;
    const wrappedPromise = new Promise((resolve, reject) => {
        const canceledPromiseRejection = { isCanceled: true };
        promise.then((val) => (hasCanceled_ ? reject(canceledPromiseRejection) : resolve(val)));
        promise.catch((error) => (hasCanceled_ ? reject(canceledPromiseRejection) : reject(error)));
    });
    return {
        promise: wrappedPromise,
        cancel() {
            hasCanceled_ = true;
        },
    };
};
//# sourceMappingURL=CancelablePromise.js.map