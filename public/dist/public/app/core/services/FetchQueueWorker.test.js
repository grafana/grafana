import { Subject } from 'rxjs';
import { FetchStatus } from './FetchQueue';
import { FetchQueueWorker } from './FetchQueueWorker';
const getTestContext = (http2Enabled = false) => {
    const config = { http2Enabled };
    const dataUrl = 'http://localhost:3000/api/ds/query?=abc';
    const apiUrl = 'http://localhost:3000/api/alerts?state=all';
    const updates = new Subject();
    const queueMock = {
        add: jest.fn(),
        setInProgress: jest.fn(),
        setDone: jest.fn(),
        getUpdates: () => updates.asObservable(),
    };
    const addMock = jest.fn();
    const responseQueueMock = {
        add: addMock,
        getResponses: jest.fn(),
    };
    new FetchQueueWorker(queueMock, responseQueueMock, config);
    return { dataUrl, apiUrl, updates, queueMock, addMock };
};
describe('FetchQueueWorker', () => {
    describe('when an update is pushed in the stream', () => {
        describe('and queue has no pending entries', () => {
            it('then nothing should be added to the responseQueue', () => {
                const { updates, addMock } = getTestContext();
                updates.next({ noOfPending: 0, noOfInProgress: 1, state: {} });
                expect(addMock).toHaveBeenCalledTimes(0);
            });
        });
        describe('and queue has pending entries', () => {
            describe('and there are no entries in progress', () => {
                it('then api request should be added before data requests responseQueue', () => {
                    const { updates, addMock, dataUrl, apiUrl } = getTestContext();
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 0,
                        state: {
                            ['data']: { state: FetchStatus.Pending, options: { url: dataUrl } },
                            ['api']: { state: FetchStatus.Pending, options: { url: apiUrl } },
                        },
                    });
                    expect(addMock.mock.calls).toEqual([
                        ['api', { url: 'http://localhost:3000/api/alerts?state=all' }],
                        ['data', { url: 'http://localhost:3000/api/ds/query?=abc' }],
                    ]);
                });
            });
            describe('and there are max concurrent entries in progress', () => {
                it('then api request should always pass through but no data requests should pass', () => {
                    const { updates, addMock, dataUrl, apiUrl } = getTestContext();
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 5,
                        state: {
                            ['data']: { state: FetchStatus.Pending, options: { url: dataUrl } },
                            ['api']: { state: FetchStatus.Pending, options: { url: apiUrl } },
                        },
                    });
                    expect(addMock.mock.calls).toEqual([['api', { url: 'http://localhost:3000/api/alerts?state=all' }]]);
                });
            });
            describe('and http2 is enabled and there are max concurrent entries in progress', () => {
                it('then api request should always pass through but no data requests should pass', () => {
                    const { updates, addMock, dataUrl, apiUrl } = getTestContext(true);
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 1000,
                        state: {
                            ['data']: { state: FetchStatus.Pending, options: { url: dataUrl } },
                            ['api']: { state: FetchStatus.Pending, options: { url: apiUrl } },
                        },
                    });
                    expect(addMock.mock.calls).toEqual([['api', { url: 'http://localhost:3000/api/alerts?state=all' }]]);
                });
            });
        });
    });
});
//# sourceMappingURL=FetchQueueWorker.test.js.map