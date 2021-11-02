import { variableQueryObserver } from './variableQueryObserver';
import { LoadingState } from '@grafana/data';
function getTestContext(args) {
    var next = args.next, error = args.error, complete = args.complete;
    var resolve = jest.fn();
    var reject = jest.fn();
    var subscription = {
        unsubscribe: jest.fn(),
    };
    var observer = variableQueryObserver(resolve, reject, subscription);
    if (next) {
        observer.next(next);
    }
    if (error) {
        observer.error(error);
    }
    if (complete) {
        observer.complete();
    }
    return { resolve: resolve, reject: reject, subscription: subscription, observer: observer };
}
var identifier = { id: 'id', type: 'query' };
describe('variableQueryObserver', function () {
    describe('when receiving a Done state', function () {
        it('then it should call unsubscribe', function () {
            var subscription = getTestContext({ next: { state: LoadingState.Done, identifier: identifier } }).subscription;
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call resolve', function () {
            var resolve = getTestContext({ next: { state: LoadingState.Done, identifier: identifier } }).resolve;
            expect(resolve).toHaveBeenCalledTimes(1);
        });
    });
    describe('when receiving an Error state', function () {
        it('then it should call unsubscribe', function () {
            var subscription = getTestContext({ next: { state: LoadingState.Error, identifier: identifier, error: 'An error' } }).subscription;
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call reject', function () {
            var reject = getTestContext({ next: { state: LoadingState.Error, identifier: identifier, error: 'An error' } }).reject;
            expect(reject).toHaveBeenCalledTimes(1);
            expect(reject).toHaveBeenCalledWith('An error');
        });
    });
    describe('when receiving an error', function () {
        it('then it should call unsubscribe', function () {
            var subscription = getTestContext({ error: 'An error' }).subscription;
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call reject', function () {
            var reject = getTestContext({ error: 'An error' }).reject;
            expect(reject).toHaveBeenCalledTimes(1);
            expect(reject).toHaveBeenCalledWith('An error');
        });
    });
    describe('when receiving complete', function () {
        it('then it should call unsubscribe', function () {
            var subscription = getTestContext({ complete: true }).subscription;
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call resolve', function () {
            var resolve = getTestContext({ complete: true }).resolve;
            expect(resolve).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=variableQueryObserver.test.js.map