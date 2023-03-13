import * as comlink from 'comlink';
import { from, Observable, switchMap } from 'rxjs';

export const remoteObservableAsObservable = <T>(remoteObs: comlink.RemoteObject<Observable<T>>): Observable<T> =>
  new Observable((subscriber) => {
    // Passing the callbacks as 3 separate arguments is deprecated, but it's the only option for now
    //
    // RxJS recreates the functions via `Function.bind` https://github.com/ReactiveX/rxjs/blob/62aca850a37f598b5db6085661e0594b81ec4281/src/internal/Subscriber.ts#L169
    // and thus erases the ProxyMarker created via comlink.proxy(fN) when the callbacks
    // are grouped together in a Observer object (ie. { next: (v) => ..., error: (err) => ..., complete: () => ... })
    //
    // solution: TBD (autoproxy all functions?)
    const remoteSubPromise = remoteObs.subscribe(
      comlink.proxy((nextValueInRemoteObs: T) => {
        subscriber.next(nextValueInRemoteObs);
      }),
      comlink.proxy((err: unknown) => {
        subscriber.error(err);
      }),
      comlink.proxy(() => {
        subscriber.complete();
      })
    );
    return {
      unsubscribe: () => {
        remoteSubPromise.then((remoteSub) => remoteSub.unsubscribe());
      },
    };
  });

export const promiseWithRemoteObservableAsObservable = <T>(
  promiseWithProxyObservable: Promise<comlink.RemoteObject<Observable<T>>>
): Observable<T> => from(promiseWithProxyObservable).pipe(switchMap((val) => remoteObservableAsObservable(val)));
