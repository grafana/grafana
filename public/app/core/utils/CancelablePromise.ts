// https://github.com/facebook/react/issues/5465

export interface CancelablePromise<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export const makePromiseCancelable = <T>(promise: Promise<T>): CancelablePromise<T> => {
  let hasCanceled_ = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(val => (hasCanceled_ ? reject({ isCanceled: true }) : resolve(val)));
    promise.catch(error => (hasCanceled_ ? reject({ isCanceled: true }) : reject(error)));
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled_ = true;
    },
  };
};
