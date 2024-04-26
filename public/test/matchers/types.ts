import { Observable } from 'rxjs';

export const OBSERVABLE_TEST_TIMEOUT_IN_MS = 1000;

export interface ObservableMatchers<R, T = {}> extends jest.ExpectExtendMap {
  toEmitValues<T>(received: Observable<T>, expected: T[]): Promise<jest.CustomMatcherResult>;
  toEmitValuesWith<T>(
    received: Observable<T>,
    expectations: (received: T[]) => void
  ): Promise<jest.CustomMatcherResult>;
}
