import { take } from 'rxjs/operators';
import { FetchQueue, FetchStatus } from './FetchQueue';
export var subscribeTester = function (_a) {
    var observable = _a.observable, expectCallback = _a.expectCallback, doneCallback = _a.doneCallback;
    observable.subscribe({
        next: function (data) { return expectCallback(data); },
        complete: function () {
            doneCallback();
        },
    });
};
describe('FetchQueue', function () {
    describe('add', function () {
        describe('when called twice', function () {
            it('then an update with the correct state should be published', function (done) {
                var _a, _b;
                var id = 'id';
                var id2 = 'id2';
                var options = { url: 'http://someurl' };
                var options2 = { url: 'http://someotherurl' };
                var expects = [
                    {
                        noOfPending: 1,
                        noOfInProgress: 0,
                        state: (_a = {},
                            _a['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _a),
                    },
                    {
                        noOfPending: 2,
                        noOfInProgress: 0,
                        state: (_b = {},
                            _b['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _b['id2'] = { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
                            _b),
                    },
                ];
                var queue = new FetchQueue();
                var calls = 0;
                subscribeTester({
                    observable: queue.getUpdates().pipe(take(2)),
                    expectCallback: function (data) { return expect(data).toEqual(expects[calls++]); },
                    doneCallback: done,
                });
                queue.add(id, options);
                queue.add(id2, options2);
            });
        });
    });
    describe('setInProgress', function () {
        describe('when called', function () {
            it('then an update with the correct state should be published', function (done) {
                var _a, _b, _c;
                var id = 'id';
                var id2 = 'id2';
                var options = { url: 'http://someurl' };
                var options2 = { url: 'http://someotherurl' };
                var expects = [
                    {
                        noOfPending: 1,
                        noOfInProgress: 0,
                        state: (_a = {},
                            _a['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _a),
                    },
                    {
                        noOfPending: 2,
                        noOfInProgress: 0,
                        state: (_b = {},
                            _b['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _b['id2'] = { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
                            _b),
                    },
                    {
                        noOfPending: 1,
                        noOfInProgress: 1,
                        state: (_c = {},
                            _c['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _c['id2'] = { options: { url: 'http://someotherurl' }, state: FetchStatus.InProgress },
                            _c),
                    },
                ];
                var queue = new FetchQueue();
                var calls = 0;
                subscribeTester({
                    observable: queue.getUpdates().pipe(take(3)),
                    expectCallback: function (data) { return expect(data).toEqual(expects[calls++]); },
                    doneCallback: done,
                });
                queue.add(id, options);
                queue.add(id2, options2);
                queue.setInProgress(id2);
            });
        });
    });
    describe('setDone', function () {
        describe('when called', function () {
            it('then an update with the correct state should be published', function (done) {
                var _a, _b, _c;
                var id = 'id';
                var id2 = 'id2';
                var options = { url: 'http://someurl' };
                var options2 = { url: 'http://someotherurl' };
                var expects = [
                    {
                        noOfPending: 1,
                        noOfInProgress: 0,
                        state: (_a = {},
                            _a['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _a),
                    },
                    {
                        noOfPending: 2,
                        noOfInProgress: 0,
                        state: (_b = {},
                            _b['id'] = { options: { url: 'http://someurl' }, state: FetchStatus.Pending },
                            _b['id2'] = { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
                            _b),
                    },
                    {
                        noOfPending: 1,
                        noOfInProgress: 0,
                        state: (_c = {},
                            _c['id2'] = { options: { url: 'http://someotherurl' }, state: FetchStatus.Pending },
                            _c),
                    },
                ];
                var queue = new FetchQueue();
                var calls = 0;
                subscribeTester({
                    observable: queue.getUpdates().pipe(take(3)),
                    expectCallback: function (data) { return expect(data).toEqual(expects[calls++]); },
                    doneCallback: done,
                });
                queue.add(id, options);
                queue.add(id2, options2);
                queue.setDone(id);
            });
        });
    });
});
//# sourceMappingURL=FetchQueue.test.js.map