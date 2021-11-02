import { Subscription } from 'rxjs';
import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { expectObservable, forceObservableCompletion } from './utils';
import { isEqual } from 'lodash';
function passMessage(received, expected) {
    return matcherHint('.not.toEmitValues') + "\n\n  Expected observable to emit values:\n    " + printExpected(expected) + "\n  Received:\n    " + printReceived(received) + "\n    ";
}
function failMessage(received, expected) {
    return matcherHint('.toEmitValues') + "\n\n  Expected observable to emit values:\n    " + printExpected(expected) + "\n  Received:\n    " + printReceived(received) + "\n    ";
}
function tryExpectations(received, expected) {
    try {
        if (received.length !== expected.length) {
            return {
                pass: false,
                message: function () { return failMessage(received, expected); },
            };
        }
        for (var index = 0; index < received.length; index++) {
            var left = received[index];
            var right = expected[index];
            if (!isEqual(left, right)) {
                return {
                    pass: false,
                    message: function () { return failMessage(received, expected); },
                };
            }
        }
        return {
            pass: true,
            message: function () { return passMessage(received, expected); },
        };
    }
    catch (err) {
        return {
            pass: false,
            message: function () { return err; },
        };
    }
}
export function toEmitValues(received, expected) {
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
                resolve(tryExpectations(receivedValues, expected));
            },
            complete: function () {
                subscription.unsubscribe();
                resolve(tryExpectations(receivedValues, expected));
            },
        }));
        forceObservableCompletion(subscription, resolve);
    });
}
//# sourceMappingURL=toEmitValues.js.map