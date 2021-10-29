import * as comlink from 'comlink';
import { Observable, Subscriber } from 'rxjs';

const createSubscriberFn = <T>(remoteObs: Observable<T>) => (subscriber: Subscriber<T>) => {
  remoteObs.subscribe(
    comlink.proxy((nextInFake: T) => {
      subscriber.next(nextInFake);
    })
  );
};

export const promiseWithRemoteObservableAsObservable = <T>(
  promiseWithProxyObservable: Promise<Observable<T>>
): Observable<T> =>
  new Observable<T>((subscriber) => {
    promiseWithProxyObservable.then((remoteObs) => {
      createSubscriberFn(remoteObs)(subscriber);
    });
  });

export const remoteObservableAsObservable = <T>(obs: Observable<T>): Observable<T> =>
  new Observable(createSubscriberFn(obs));
