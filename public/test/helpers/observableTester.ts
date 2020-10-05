import { Observable } from 'rxjs';

interface ObservableTester<T> {
  observable: Observable<T>;
  done: jest.DoneCallback;
}

interface SubscribeAndExpectOnNext<T> extends ObservableTester<T> {
  expect: (value: T) => void;
}

interface SubscribeAndExpectOnNextAndComplete<T> extends ObservableTester<T> {
  expectOnNext: (value: T) => void;
  expectOnComplete: () => void;
}

interface SubscribeAndExpectOnComplete<T> extends ObservableTester<T> {
  expect: () => void;
}

interface SubscribeAndExpectOnError<T> extends ObservableTester<T> {
  expect: (err: any) => void;
}

export const observableTester = () => {
  const subscribeAndExpectOnNext = <T>({ observable, expect, done }: SubscribeAndExpectOnNext<T>): void => {
    observable.subscribe({
      next: value => {
        try {
          expect(value);
        } catch (err) {
          done.fail(err);
        }
      },
      error: err => done.fail(err),
      complete: () => done(),
    });
  };

  const subscribeAndExpectOnComplete = <T>({ observable, expect, done }: SubscribeAndExpectOnComplete<T>): void => {
    observable.subscribe({
      next: () => {},
      error: err => done.fail(err),
      complete: () => {
        try {
          expect();
          done();
        } catch (err) {
          done.fail(err);
        }
      },
    });
  };

  const subscribeAndExpectOnNextAndComplete = <T>({
    observable,
    expectOnComplete,
    expectOnNext,
    done,
  }: SubscribeAndExpectOnNextAndComplete<T>): void => {
    observable.subscribe({
      next: (value: T) => {
        try {
          expectOnNext(value);
          done();
        } catch (err) {
          done.fail(err);
        }
      },
      error: err => done.fail(err),
      complete: () => {
        try {
          expectOnComplete();
          done();
        } catch (err) {
          done.fail(err);
        }
      },
    });
  };

  const subscribeAndExpectOnError = <T>({ observable, expect, done }: SubscribeAndExpectOnError<T>): void => {
    observable.subscribe({
      next: () => {},
      error: err => {
        try {
          expect(err);
          done();
        } catch (err) {
          done.fail(err);
        }
      },
      complete: () => {
        done();
      },
    });
  };

  return {
    subscribeAndExpectOnNext,
    subscribeAndExpectOnComplete,
    subscribeAndExpectOnNextAndComplete,
    subscribeAndExpectOnError,
  };
};
