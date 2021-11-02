import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { OBSERVABLE_TEST_TIMEOUT_IN_MS } from './types';
import { asapScheduler, timer, isObservable } from 'rxjs';
export function forceObservableCompletion(subscription, resolve) {
    var timeoutObservable = timer(OBSERVABLE_TEST_TIMEOUT_IN_MS, asapScheduler);
    subscription.add(timeoutObservable.subscribe(function () {
        subscription.unsubscribe();
        resolve({
            pass: false,
            message: function () {
                return matcherHint('.toEmitValues') + "\n\n    Expected " + printReceived('Observable') + " to be " + printExpected("completed within " + OBSERVABLE_TEST_TIMEOUT_IN_MS + "ms") + " but it did not.";
            },
        });
    }));
}
export function expectObservableToBeDefined(received) {
    if (received) {
        return null;
    }
    return {
        pass: false,
        message: function () { return matcherHint('.toEmitValues') + "\n\nExpected " + printReceived(received) + " to be " + printExpected('defined') + "."; },
    };
}
export function expectObservableToBeObservable(received) {
    if (isObservable(received)) {
        return null;
    }
    return {
        pass: false,
        message: function () { return matcherHint('.toEmitValues') + "\n\nExpected " + printReceived(received) + " to be " + printExpected('an Observable') + "."; },
    };
}
export function expectObservable(received) {
    var toBeDefined = expectObservableToBeDefined(received);
    if (toBeDefined) {
        return toBeDefined;
    }
    var toBeObservable = expectObservableToBeObservable(received);
    if (toBeObservable) {
        return toBeObservable;
    }
    return null;
}
//# sourceMappingURL=utils.js.map