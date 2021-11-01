import * as comlink from 'comlink';
import { from, Observable, switchMap } from 'rxjs';

export const remoteObservableAsObservable = <T>(remoteObs: comlink.Remote<Observable<T>>): Observable<T> =>
  new Observable((subscriber) => {
    const remoteSubPromise = remoteObs.subscribe(
      comlink.proxy((nextValueInRemoteObs: T) => {
        subscriber.next(nextValueInRemoteObs);
      })
    );
    return {
      unsubscribe: () => {
        remoteSubPromise.then((remoteSub) => remoteSub.unsubscribe());
      },
    };
  });

export const promiseWithRemoteObservableAsObservable = <T>(
  promiseWithProxyObservable: Promise<comlink.Remote<Observable<T>>>
): Observable<T> => from(promiseWithProxyObservable).pipe(switchMap((val) => remoteObservableAsObservable(val)));
