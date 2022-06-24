import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { isEqual } from 'lodash';
import { Observable, Subscription } from 'rxjs';

import { expectObservable, forceObservableCompletion } from './utils';

function passMessage(received: any[], expected: any[]) {
  return `${matcherHint('.not.toEmitValues')}

  Expected observable to emit values:
    ${printExpected(expected)}
  Received:
    ${printReceived(received)}
    `;
}

function failMessage(received: any[], expected: any[]) {
  return `${matcherHint('.toEmitValues')}

  Expected observable to emit values:
    ${printExpected(expected)}
  Received:
    ${printReceived(received)}
    `;
}

function tryExpectations(received: any[], expected: any[]): jest.CustomMatcherResult {
  try {
    if (received.length !== expected.length) {
      return {
        pass: false,
        message: () => failMessage(received, expected),
      };
    }

    for (let index = 0; index < received.length; index++) {
      const left = received[index];
      const right = expected[index];

      if (!isEqual(left, right)) {
        return {
          pass: false,
          message: () => failMessage(received, expected),
        };
      }
    }

    return {
      pass: true,
      message: () => passMessage(received, expected),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return {
      pass: false,
      message: () => message,
    };
  }
}

export function toEmitValues(received: Observable<any>, expected: any[]): Promise<jest.CustomMatcherResult> {
  const failsChecks = expectObservable(received);
  if (failsChecks) {
    return Promise.resolve(failsChecks);
  }

  return new Promise((resolve) => {
    const receivedValues: any[] = [];
    const subscription = new Subscription();

    subscription.add(
      received.subscribe({
        next: (value) => {
          receivedValues.push(value);
        },
        error: (err) => {
          receivedValues.push(err);
          subscription.unsubscribe();
          resolve(tryExpectations(receivedValues, expected));
        },
        complete: () => {
          subscription.unsubscribe();
          resolve(tryExpectations(receivedValues, expected));
        },
      })
    );

    forceObservableCompletion(subscription, resolve);
  });
}
