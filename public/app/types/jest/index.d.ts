import { Observable } from 'rxjs';

export {};

type ObservableType<T> = T extends Observable<infer V> ? V : never;

declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      toEmitValues(expected: Array<ObservableType<T>>): Promise<CustomMatcherResult>;
      toEmitValuesWith(expectations: (received: Array<ObservableType<T>>) => void): Promise<CustomMatcherResult>;
    }
  }
}
