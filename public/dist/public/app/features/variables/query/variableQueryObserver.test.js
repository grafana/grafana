import { LoadingState } from '@grafana/data';
import { variableQueryObserver } from './variableQueryObserver';
function getTestContext(args) {
    const { next, error, complete } = args;
    const resolve = jest.fn();
    const reject = jest.fn();
    const subscription = {
        unsubscribe: jest.fn(),
    };
    const observer = variableQueryObserver(resolve, reject, subscription);
    if (next) {
        observer.next(next);
    }
    if (error) {
        observer.error(error);
    }
    if (complete) {
        observer.complete();
    }
    return { resolve, reject, subscription, observer };
}
const identifier = { id: 'id', type: 'query', rootStateKey: 'uid' };
describe('variableQueryObserver', () => {
    describe('when receiving a Done state', () => {
        it('then it should call unsubscribe', () => {
            const { subscription } = getTestContext({ next: { state: LoadingState.Done, identifier } });
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call resolve', () => {
            const { resolve } = getTestContext({ next: { state: LoadingState.Done, identifier } });
            expect(resolve).toHaveBeenCalledTimes(1);
        });
    });
    describe('when receiving an Error state', () => {
        it('then it should call unsubscribe', () => {
            const { subscription } = getTestContext({ next: { state: LoadingState.Error, identifier, error: 'An error' } });
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call reject', () => {
            const { reject } = getTestContext({ next: { state: LoadingState.Error, identifier, error: 'An error' } });
            expect(reject).toHaveBeenCalledTimes(1);
            expect(reject).toHaveBeenCalledWith('An error');
        });
    });
    describe('when receiving an error', () => {
        it('then it should call unsubscribe', () => {
            const { subscription } = getTestContext({ error: 'An error' });
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call reject', () => {
            const { reject } = getTestContext({ error: 'An error' });
            expect(reject).toHaveBeenCalledTimes(1);
            expect(reject).toHaveBeenCalledWith('An error');
        });
    });
    describe('when receiving complete', () => {
        it('then it should call unsubscribe', () => {
            const { subscription } = getTestContext({ complete: true });
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });
        it('then it should call resolve', () => {
            const { resolve } = getTestContext({ complete: true });
            expect(resolve).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=variableQueryObserver.test.js.map