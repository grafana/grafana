import { Observable, Subscription } from 'rxjs';
import { expectObservable, forceObservableCompletion } from './utils';
import { matcherHint, printReceived } from 'jest-matcher-utils';

function tryExpectations(received: any[], expectations: (received: any[]) => void): jest.CustomMatcherResult {
  try {
    expectations(received);
    return {
      pass: true,
      message: () => `${matcherHint('.not.toEmitValues')}

  Expected observable to complete with
    ${printReceived(received)}
    `,
    };
  } catch (err) {
    return {
      pass: false,
      message: () => 'failed ' + err,
    };
  }
}

export function toEmitValuesWith(
  received: Observable<any>,
  expectations: (actual: any[]) => void
): Promise<jest.CustomMatcherResult> {
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
          resolve(tryExpectations(receivedValues, expectations));
        },
        complete: () => {
          subscription.unsubscribe();
          resolve(tryExpectations(receivedValues, expectations));
        },
      })
    );

    forceObservableCompletion(subscription, resolve);
  });
}
