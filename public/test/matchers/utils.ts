import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { OBSERVABLE_TEST_TIMEOUT_IN_MS } from './types';
import { Observable, Subscription } from 'rxjs';

export function forceObservableCompletion(subscription: Subscription, resolve: (args: any) => void) {
  setTimeout(() => {
    subscription.unsubscribe();
    resolve({
      pass: false,
      message: () =>
        `${matcherHint('.toEmitValues')}

          Expected ${printReceived('Observable')} to be ${printExpected(
          `completed within ${OBSERVABLE_TEST_TIMEOUT_IN_MS}ms`
        )} but it did not.`,
    });
  }, OBSERVABLE_TEST_TIMEOUT_IN_MS);
}

export function expectObservableToBeDefined(received: any): jest.CustomMatcherResult | null {
  if (received) {
    return null;
  }

  return {
    pass: false,
    message: () => `${matcherHint('.toEmitValues')}

Expected ${printReceived(received)} to be ${printExpected('defined')}.`,
  };
}

export function expectObservableToBeObservable(received: any): jest.CustomMatcherResult | null {
  if (received instanceof Observable) {
    return null;
  }

  return {
    pass: false,
    message: () => `${matcherHint('.toEmitValues')}

Expected ${printReceived(received)} to be ${printExpected('defined')}.`,
  };
}

export function expectObservable(received: any): jest.CustomMatcherResult | null {
  const toBeDefined = expectObservableToBeDefined(received);
  if (toBeDefined) {
    return toBeDefined;
  }

  const toBeObservable = expectObservableToBeObservable(received);
  if (toBeObservable) {
    return toBeObservable;
  }

  return null;
}
