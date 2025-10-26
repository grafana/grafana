import { Observable } from 'rxjs';

export const OBSERVABLE_TEST_TIMEOUT_IN_MS = 1000;

export interface ObservableMatchers<R, T = {}> extends jest.ExpectExtendMap {
  toEmitValues<T>(received: Observable<T>, expected: T[]): Promise<jest.CustomMatcherResult>;
  toEmitValuesWith<T>(
    received: Observable<T>,
    expectations: (received: T[]) => void
  ): Promise<jest.CustomMatcherResult>;
}

type ObservableType<T> = T extends Observable<infer V> ? V : never;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R, T = {}> {
      toEmitValues<E = ObservableType<T>>(expected: E[]): Promise<CustomMatcherResult>;
      /**
       * Collect all the values emitted by the observables (also errors) and pass them to the expectations functions after
       * the observable ended (or emitted error). If Observable does not complete within OBSERVABLE_TEST_TIMEOUT_IN_MS the
       * test fails.
       */
      toEmitValuesWith<E = ObservableType<T>>(expectations: (received: E[]) => void): Promise<CustomMatcherResult>;
    }
  }
}
