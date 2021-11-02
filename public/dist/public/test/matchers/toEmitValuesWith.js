import { Subscription } from 'rxjs';
import { expectObservable, forceObservableCompletion } from './utils';
import { matcherHint, printReceived } from 'jest-matcher-utils';
function tryExpectations(received, expectations) {
    try {
        expectations(received);
        return {
            pass: true,
            message: function () { return matcherHint('.not.toEmitValues') + "\n\n  Expected observable to complete with\n    " + printReceived(received) + "\n    "; },
        };
    }
    catch (err) {
        return {
            pass: false,
            message: function () { return 'failed ' + err; },
        };
    }
}
/**
 * Collect all the values emitted by the observables (also errors) and pass them to the expectations functions after
 * the observable ended (or emitted error). If Observable does not complete within OBSERVABLE_TEST_TIMEOUT_IN_MS the
 * test fails.
 */
export function toEmitValuesWith(received, expectations) {
    var failsChecks = expectObservable(received);
    if (failsChecks) {
        return Promise.resolve(failsChecks);
    }
    return new Promise(function (resolve) {
        var receivedValues = [];
        var subscription = new Subscription();
        subscription.add(received.subscribe({
            next: function (value) {
                receivedValues.push(value);
            },
            error: function (err) {
                receivedValues.push(err);
                subscription.unsubscribe();
                resolve(tryExpectations(receivedValues, expectations));
            },
            complete: function () {
                subscription.unsubscribe();
                resolve(tryExpectations(receivedValues, expectations));
            },
        }));
        forceObservableCompletion(subscription, resolve);
    });
}
//# sourceMappingURL=toEmitValuesWith.js.map