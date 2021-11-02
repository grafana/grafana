import { Subject } from 'rxjs';
import { FetchStatus } from './FetchQueue';
import { FetchQueueWorker } from './FetchQueueWorker';
import { expect } from '../../../test/lib/common';
var getTestContext = function (http2Enabled) {
    if (http2Enabled === void 0) { http2Enabled = false; }
    var config = { http2Enabled: http2Enabled };
    var dataUrl = 'http://localhost:3000/api/ds/query?=abc';
    var apiUrl = 'http://localhost:3000/api/alerts?state=all';
    var updates = new Subject();
    var queueMock = {
        add: jest.fn(),
        setInProgress: jest.fn(),
        setDone: jest.fn(),
        getUpdates: function () { return updates.asObservable(); },
    };
    var addMock = jest.fn();
    var responseQueueMock = {
        add: addMock,
        getResponses: jest.fn(),
    };
    new FetchQueueWorker(queueMock, responseQueueMock, config);
    return { dataUrl: dataUrl, apiUrl: apiUrl, updates: updates, queueMock: queueMock, addMock: addMock };
};
describe('FetchQueueWorker', function () {
    describe('when an update is pushed in the stream', function () {
        describe('and queue has no pending entries', function () {
            it('then nothing should be added to the responseQueue', function () {
                var _a = getTestContext(), updates = _a.updates, addMock = _a.addMock;
                updates.next({ noOfPending: 0, noOfInProgress: 1, state: {} });
                expect(addMock).toHaveBeenCalledTimes(0);
            });
        });
        describe('and queue has pending entries', function () {
            describe('and there are no entries in progress', function () {
                it('then api request should be added before data requests responseQueue', function () {
                    var _a;
                    var _b = getTestContext(), updates = _b.updates, addMock = _b.addMock, dataUrl = _b.dataUrl, apiUrl = _b.apiUrl;
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 0,
                        state: (_a = {},
                            _a['data'] = { state: FetchStatus.Pending, options: { url: dataUrl } },
                            _a['api'] = { state: FetchStatus.Pending, options: { url: apiUrl } },
                            _a),
                    });
                    expect(addMock.mock.calls).toEqual([
                        ['api', { url: 'http://localhost:3000/api/alerts?state=all' }],
                        ['data', { url: 'http://localhost:3000/api/ds/query?=abc' }],
                    ]);
                });
            });
            describe('and there are max concurrent entries in progress', function () {
                it('then api request should always pass through but no data requests should pass', function () {
                    var _a;
                    var _b = getTestContext(), updates = _b.updates, addMock = _b.addMock, dataUrl = _b.dataUrl, apiUrl = _b.apiUrl;
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 5,
                        state: (_a = {},
                            _a['data'] = { state: FetchStatus.Pending, options: { url: dataUrl } },
                            _a['api'] = { state: FetchStatus.Pending, options: { url: apiUrl } },
                            _a),
                    });
                    expect(addMock.mock.calls).toEqual([['api', { url: 'http://localhost:3000/api/alerts?state=all' }]]);
                });
            });
            describe('and http2 is enabled and there are max concurrent entries in progress', function () {
                it('then api request should always pass through but no data requests should pass', function () {
                    var _a;
                    var _b = getTestContext(true), updates = _b.updates, addMock = _b.addMock, dataUrl = _b.dataUrl, apiUrl = _b.apiUrl;
                    updates.next({
                        noOfPending: 2,
                        noOfInProgress: 1000,
                        state: (_a = {},
                            _a['data'] = { state: FetchStatus.Pending, options: { url: dataUrl } },
                            _a['api'] = { state: FetchStatus.Pending, options: { url: apiUrl } },
                            _a),
                    });
                    expect(addMock.mock.calls).toEqual([['api', { url: 'http://localhost:3000/api/alerts?state=all' }]]);
                });
            });
        });
    });
});
//# sourceMappingURL=FetchQueueWorker.test.js.map