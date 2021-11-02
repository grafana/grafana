import { __assign, __awaiter, __generator } from "tslib";
import { Observable, Subject, of, throwError, concat } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import * as rxJsWebSocket from 'rxjs/webSocket';
import { LiveStreams } from './live_streams';
import { DataFrameView, formatLabels } from '@grafana/data';
import { noop } from 'lodash';
var fakeSocket;
jest.mock('rxjs/webSocket', function () {
    return {
        __esModule: true,
        webSocket: function () { return fakeSocket; },
    };
});
describe('Live Stream Tests', function () {
    afterAll(function () {
        jest.restoreAllMocks();
    });
    var msg0 = {
        streams: [
            {
                stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
                values: [['1567025440118944705', 'Kittens']],
            },
        ],
        dropped_entries: null,
    };
    it('reads the values into the buffer', function (done) {
        fakeSocket = new Subject();
        var labels = { job: 'varlogs' };
        var target = makeTarget('fake', labels);
        var stream = new LiveStreams().getStream(target);
        expect.assertions(4);
        var tests = [
            function (val) {
                expect(val[0].length).toEqual(7);
                expect(val[0].fields[2].labels).toEqual(labels);
            },
            function (val) {
                expect(val[0].length).toEqual(8);
                var view = new DataFrameView(val[0]);
                var last = __assign({}, view.get(view.length - 1));
                expect(last).toEqual({
                    ts: '2019-08-28T20:50:40.118Z',
                    tsNs: '1567025440118944705',
                    id: '25d81461-a66f-53ff-98d5-e39515af4735_A',
                    line: 'Kittens',
                    labels: { filename: '/var/log/sntpc.log' },
                });
            },
        ];
        stream.subscribe({
            next: function (val) {
                var test = tests.shift();
                test(val);
            },
            complete: function () { return done(); },
        });
        // Send it the initial list of things
        fakeSocket.next(initialRawResponse);
        // Send it a single update
        fakeSocket.next(msg0);
        fakeSocket.complete();
    });
    it('returns the same subscription if the url matches existing one', function () {
        fakeSocket = new Subject();
        var liveStreams = new LiveStreams();
        var stream1 = liveStreams.getStream(makeTarget('url_to_match'));
        var stream2 = liveStreams.getStream(makeTarget('url_to_match'));
        expect(stream1).toBe(stream2);
    });
    it('returns new subscription when the previous unsubscribed', function () {
        fakeSocket = new Subject();
        var liveStreams = new LiveStreams();
        var stream1 = liveStreams.getStream(makeTarget('url_to_match'));
        var subscription = stream1.subscribe({
            next: noop,
        });
        subscription.unsubscribe();
        var stream2 = liveStreams.getStream(makeTarget('url_to_match'));
        expect(stream1).not.toBe(stream2);
    });
    it('returns new subscription when the previous is unsubscribed and correctly unsubscribes from source', function () {
        var unsubscribed = false;
        fakeSocket = new Observable(function () {
            return function () { return (unsubscribed = true); };
        });
        var spy = spyOn(rxJsWebSocket, 'webSocket');
        spy.and.returnValue(fakeSocket);
        var liveStreams = new LiveStreams();
        var stream1 = liveStreams.getStream(makeTarget('url_to_match'));
        var subscription = stream1.subscribe({
            next: noop,
        });
        subscription.unsubscribe();
        expect(unsubscribed).toBe(true);
    });
    it('should reconnect when abnormal error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var abnormalError, logStreamBeforeError, logStreamAfterError, errorStream, retries, liveStreams;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    abnormalError = new Error('weird error');
                    abnormalError.code = 1006;
                    logStreamBeforeError = of({
                        streams: [
                            {
                                stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
                                values: [['1567025440118944705', 'Kittens']],
                            },
                        ],
                        dropped_entries: null,
                    });
                    logStreamAfterError = of({
                        streams: [
                            {
                                stream: { filename: '/var/log/sntpc.log', job: 'varlogs' },
                                values: [['1567025440118944705', 'Doggos']],
                            },
                        ],
                        dropped_entries: null,
                    });
                    errorStream = throwError(abnormalError);
                    retries = 0;
                    fakeSocket = of({}).pipe(mergeMap(function () {
                        // When subscribed first time, return logStream and errorStream
                        if (retries++ === 0) {
                            return concat(logStreamBeforeError, errorStream);
                        }
                        // When re-subsribed after abnormal error, return just logStream
                        return logStreamAfterError;
                    }));
                    liveStreams = new LiveStreams();
                    return [4 /*yield*/, expect(liveStreams.getStream(makeTarget('url_to_match'), 100)).toEmitValuesWith(function (received) {
                            var data = received[0];
                            var view = new DataFrameView(data[0]);
                            var firstLog = __assign({}, view.get(0));
                            var secondLog = __assign({}, view.get(1));
                            expect(firstLog.line).toBe('Kittens');
                            expect(secondLog.line).toBe('Doggos');
                            expect(retries).toBe(2);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
/**
 * Create target (query to run). Url is what is used as cache key.
 */
function makeTarget(url, labels) {
    labels = labels || { job: 'varlogs' };
    return {
        url: url,
        size: 10,
        query: formatLabels(labels),
        refId: 'A',
        regexp: '',
    };
}
//----------------------------------------------------------------
// Added this at the end so the top is more readable
//----------------------------------------------------------------
var initialRawResponse = {
    streams: [
        {
            stream: {
                filename: '/var/log/docker.log',
                job: 'varlogs',
            },
            values: [
                [
                    '1567025018215000000',
                    'level=debug msg="[resolver] received AAAA record \\"::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
                ],
                [
                    '1567025018215000000',
                    '2019-08-28T20:43:38Z docker time="2019-08-28T20:43:38.147224630Z" ' +
                        'level=debug msg="[resolver] received AAAA record \\"fe80::1\\" for \\"localhost.\\" from udp:192.168.65.1"',
                ],
                ['1567025020452000000', '2019-08-28T20:43:40Z sntpc sntpc[1]: offset=-0.022171, delay=0.000463'],
                ['1567025050297000000', '2019-08-28T20:44:10Z sntpc sntpc[1]: offset=-0.022327, delay=0.000527'],
                [
                    '1567025078152000000',
                    '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095444834Z" ' +
                        'level=debug msg="Name To resolve: localhost."',
                ],
                [
                    '1567025078152000000',
                    '2019-08-28T20:44:38Z lifecycle-server time="2019-08-28T20:44:38.095896074Z" ' +
                        'level=debug msg="[resolver] query localhost. (A) from 172.22.0.4:53748, forwarding to udp:192.168.65.1"',
                ],
                [
                    '1567025078152000000',
                    '2019-08-28T20:44:38Z docker time="2019-08-28T20:44:38.095444834Z" level=debug msg="Name To resolve: localhost."',
                ],
            ],
        },
    ],
    dropped_entries: null,
};
//# sourceMappingURL=live_streams.test.js.map