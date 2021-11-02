import { of } from 'rxjs';
import { first } from 'rxjs/operators';
import { ResponseQueue } from './ResponseQueue';
import { subscribeTester } from './FetchQueue.test';
import { describe, expect } from '../../../test/lib/common';
var getTestContext = function () {
    var id = 'id';
    var options = { url: 'http://someurl' };
    var expects = [];
    var fetchResult = of({
        data: id,
        status: 200,
        statusText: 'OK',
        ok: true,
        headers: null,
        redirected: false,
        type: null,
        url: options.url,
        config: null,
    });
    var fetchMock = jest.fn().mockReturnValue(fetchResult);
    var setInProgressMock = jest.fn();
    var queueMock = {
        add: jest.fn(),
        setInProgress: setInProgressMock,
        setDone: jest.fn(),
        getUpdates: jest.fn(),
    };
    var responseQueue = new ResponseQueue(queueMock, fetchMock);
    return { id: id, options: options, expects: expects, fetchMock: fetchMock, setInProgressMock: setInProgressMock, responseQueue: responseQueue, fetchResult: fetchResult };
};
describe('ResponseQueue', function () {
    describe('add', function () {
        describe('when called', function () {
            it('then the matching fetchQueue entry should be set to inProgress', function () {
                var _a = getTestContext(), id = _a.id, options = _a.options, setInProgressMock = _a.setInProgressMock, responseQueue = _a.responseQueue;
                responseQueue.add(id, options);
                expect(setInProgressMock.mock.calls).toEqual([['id']]);
            });
            it('then a response entry with correct id should be published', function (done) {
                var _a = getTestContext(), id = _a.id, options = _a.options, responseQueue = _a.responseQueue;
                subscribeTester({
                    observable: responseQueue.getResponses(id).pipe(first()),
                    expectCallback: function (data) { return expect(data.id).toEqual(id); },
                    doneCallback: done,
                });
                responseQueue.add(id, options);
            });
            it('then fetch is called with correct options', function (done) {
                var _a = getTestContext(), id = _a.id, options = _a.options, responseQueue = _a.responseQueue, fetchMock = _a.fetchMock;
                subscribeTester({
                    observable: responseQueue.getResponses(id).pipe(first()),
                    expectCallback: function () {
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({ url: 'http://someurl' });
                    },
                    doneCallback: done,
                });
                responseQueue.add(id, options);
            });
            describe('and when the fetch Observable is completed', function () {
                it('then the matching fetchQueue entry should be set to Done', function (done) {
                    var _a = getTestContext(), id = _a.id, options = _a.options, responseQueue = _a.responseQueue, setInProgressMock = _a.setInProgressMock;
                    subscribeTester({
                        observable: responseQueue.getResponses(id).pipe(first()),
                        expectCallback: function (data) {
                            data.observable.subscribe().unsubscribe();
                            expect(setInProgressMock.mock.calls).toEqual([['id']]);
                        },
                        doneCallback: done,
                    });
                    responseQueue.add(id, options);
                });
            });
        });
    });
});
//# sourceMappingURL=ResponseQueue.test.js.map