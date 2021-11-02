import { __values } from "tslib";
import kbn from './kbn';
var formatTests = [
    // Currency
    { id: 'currencyUSD', decimals: 2, value: 1532.82, result: '$1.53K' },
    { id: 'currencyKRW', decimals: 2, value: 1532.82, result: '₩1.53K' },
    { id: 'currencyIDR', decimals: 2, value: 1532.82, result: 'Rp1.53K' },
    // Typical
    { id: 'ms', decimals: 4, value: 0.0024, result: '0.0024 ms' },
    { id: 'ms', decimals: 0, value: 100, result: '100 ms' },
    { id: 'ms', decimals: 2, value: 1250, result: '1.25 s' },
    { id: 'ms', decimals: 1, value: 10000086.123, result: '2.8 hour' },
    { id: 'ms', decimals: 0, value: 1200, result: '1 s' },
    { id: 'short', decimals: 0, value: 98765, result: '99 K' },
    { id: 'short', decimals: 0, value: 9876543, result: '10 Mil' },
    { id: 'kbytes', decimals: 3, value: 10000000, result: '9.537 GiB' },
    { id: 'deckbytes', decimals: 3, value: 10000000, result: '10.000 GB' },
    { id: 'megwatt', decimals: 3, value: 1000, result: '1.000 GW' },
    { id: 'kohm', decimals: 3, value: 1000, result: '1.000 MΩ' },
    { id: 'Mohm', decimals: 3, value: 1000, result: '1.000 GΩ' },
    { id: 'farad', decimals: 3, value: 1000, result: '1.000 kF' },
    { id: 'µfarad', decimals: 3, value: 1000, result: '1.000 mF' },
    { id: 'nfarad', decimals: 3, value: 1000, result: '1.000 µF' },
    { id: 'pfarad', decimals: 3, value: 1000, result: '1.000 nF' },
    { id: 'ffarad', decimals: 3, value: 1000, result: '1.000 pF' },
    { id: 'henry', decimals: 3, value: 1000, result: '1.000 kH' },
    { id: 'mhenry', decimals: 3, value: 1000, result: '1.000 H' },
    { id: 'µhenry', decimals: 3, value: 1000, result: '1.000 mH' },
];
describe('Chcek KBN value formats', function () {
    var e_1, _a;
    var _loop_1 = function (test_1) {
        describe("value format: " + test_1.id, function () {
            it("should translate " + test_1.value + " as " + test_1.result, function () {
                var result = kbn.valueFormats[test_1.id](test_1.value, test_1.decimals);
                expect(result).toBe(test_1.result);
            });
        });
    };
    try {
        for (var formatTests_1 = __values(formatTests), formatTests_1_1 = formatTests_1.next(); !formatTests_1_1.done; formatTests_1_1 = formatTests_1.next()) {
            var test_1 = formatTests_1_1.value;
            _loop_1(test_1);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (formatTests_1_1 && !formatTests_1_1.done && (_a = formatTests_1.return)) _a.call(formatTests_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
describe('describe_interval', function () {
    it('falls back to seconds if input is a number', function () {
        expect(kbn.describeInterval('123')).toEqual({
            sec: 1,
            type: 's',
            count: 123,
        });
    });
    it('parses a valid time unt string correctly', function () {
        expect(kbn.describeInterval('123h')).toEqual({
            sec: 3600,
            type: 'h',
            count: 123,
        });
    });
    it('fails if input is invalid', function () {
        expect(function () { return kbn.describeInterval('123xyz'); }).toThrow();
        expect(function () { return kbn.describeInterval('xyz'); }).toThrow();
    });
});
//# sourceMappingURL=kbn.test.js.map