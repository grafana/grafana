// https://github.com/facebook/react/issues/5465

export interface CancelablePromise<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export interface CancelablePromiseRejection {
  isCanceled: boolean;
}

export function isCancelablePromiseRejection(promise: unknown): promise is CancelablePromiseRejection {
  return typeof promise === 'object' && promise !== null && 'isCanceled' in promise;
}

export const makePromiseCancelable = <T>(promise: Promise<T>): CancelablePromise<T> => {
  let hasCanceled_ = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    const canceledPromiseRejection: CancelablePromiseRejection = { isCanceled: true };
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
