import { Observable } from 'rxjs';

export const OBSERVABLE_TEST_TIMEOUT_IN_MS = 1000;

export type ObservableType<T> = T extends Observable<infer V> ? V : never;

export interface ObservableMatchers<R, T = {}> extends jest.ExpectExtendMap {
  toEmitValues<E = ObservableType<T>>(received: T, expected: E[]): Promise<jest.CustomMatcherResult>;
  toEmitValuesWith<E = ObservableType<T>>(
    received: T,
    expectations: (received: E[]) => void
  ): Promise<jest.CustomMatcherResult>;
}
