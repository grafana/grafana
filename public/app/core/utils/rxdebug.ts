import { Observable } from 'rxjs';

type DebugSubscribeOptions<T> = {
  onSubscribe?: (observable: Observable<T>) => void;
  onUnsubscribe?: (observable: Observable<T>) => void;
  message?: string;
};

/**
 * This is just for debugging subscribe/unsubscribe issues with RxJs pipelines. Means this should not be used anywhere
 * by default but should not be deleted. Also this is not guarantied to not alter the behaviour in some cases
 * (like multicasting) so use just for debugging and do not leave in code.
 *
 * To use just wrap what ever observable (portion of the pipeline) to see whether something fails tu unsubscribe
 * or whether number of subscription does not match the number of unsubscribes.
 *
 * Usage:
 * debugSubscribe()(someObservable)
 * debugSubscribe({ message: 'some message that will be appended to the log' })(someObservable)
 * debugSubscribe({
 *   onSubscribe(observable) {console.log('Log what you need here')},
 *   onUnsubscribe(observable) {...}
 * })(someObservable)
 */
export const debugSubscribe = <T>(options?: DebugSubscribeOptions<T>) => (observable: Observable<T>): Observable<T> => {
  return new Observable<T>(subscriber => {
    const message = (options && options.message) || '';
    options = {
      onSubscribe: observable => console.log(`Subscribe ${message}`, observable),
      onUnsubscribe: observable => console.log(`Unsubscribe ${message}`, observable),
      ...options,
    };
    options.onSubscribe(observable);
    const subscription = observable.subscribe(subscriber);
    return () => {
      options.onUnsubscribe(observable);
      subscription.unsubscribe();
    };
  });
};
