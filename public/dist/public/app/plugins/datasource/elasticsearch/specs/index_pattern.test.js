///<amd-dependency path="test/specs/helpers" name="helpers" />
import { IndexPattern } from '../index_pattern';
import { toUtc, getLocale, setLocale, dateTime } from '@grafana/data';
describe('IndexPattern', function () {
    var originalLocale = getLocale();
    afterEach(function () { return setLocale(originalLocale); });
    describe('when getting index for today', function () {
        test('should return correct index name', function () {
            var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
            var expected = 'asd-' + toUtc().format('YYYY.MM.DD');
            expect(pattern.getIndexForToday()).toBe(expected);
        });
        test('should format date using western arabic numerals regardless of locale', function () {
            setLocale('ar_SA'); // saudi-arabic, formatting for YYYY.MM.DD looks like "٢٠٢٠.٠٩.٠٣"
            var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
            var expected = 'asd-' + toUtc().locale('en').format('YYYY.MM.DD');
            expect(pattern.getIndexForToday()).toBe(expected);
        });
    });
    describe('when getting index list for time range', function () {
        describe('no interval', function () {
            test('should return correct index', function () {
                var pattern = new IndexPattern('my-metrics');
                var from = dateTime(new Date(2015, 4, 30, 1, 2, 3));
                var to = dateTime(new Date(2015, 5, 1, 12, 5, 6));
                expect(pattern.getIndexList(from, to)).toEqual('my-metrics');
            });
        });
        describe('daily', function () {
            test('should return correct index list', function () {
                var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
                var from = dateTime(new Date(1432940523000));
                var to = dateTime(new Date(1433153106000));
                var expected = ['asd-2015.05.29', 'asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01'];
                expect(pattern.getIndexList(from, to)).toEqual(expected);
            });
            test('should format date using western arabic numerals regardless of locale', function () {
                setLocale('ar_SA'); // saudi-arabic, formatting for YYYY.MM.DD looks like "٢٠٢٠.٠٩.٠٣"
                var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
                var from = dateTime(new Date(1432940523000));
                var to = dateTime(new Date(1433153106000));
                var expected = ['asd-2015.05.29', 'asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01'];
                expect(pattern.getIndexList(from, to)).toEqual(expected);
            });
        });
        describe('weekly', function () {
            it('should return correct index list', function () {
                var pattern = new IndexPattern('[asd-]YYYY.WW', 'Weekly');
                // Sunday, February 21, 2021 1:00:00 AM
                var from = dateTime(new Date(1613869200000));
                // Friday, March 5, 2021 1:00:00 AM
                var to = dateTime(new Date(1614906000000));
                var expected = ['asd-2021.07', 'asd-2021.08', 'asd-2021.09'];
                expect(pattern.getIndexList(from, to)).toEqual(expected);
            });
        });
    });
    describe('when getting index list from single date', function () {
        it('Should return index matching the starting time and subsequent ones', function () {
            var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
            var from = dateTime(new Date(1432940523000));
            var expected = [
                'asd-2015.05.29',
                'asd-2015.05.30',
                'asd-2015.05.31',
                'asd-2015.06.01',
                'asd-2015.06.02',
                'asd-2015.06.03',
                'asd-2015.06.04',
                'asd-2015.06.05',
            ];
            expect(pattern.getIndexList(from)).toEqual(expected);
        });
        it('Should return index matching the starting time and previous ones', function () {
            var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
            var to = dateTime(new Date(1432940523000));
            var expected = [
                'asd-2015.05.22',
                'asd-2015.05.23',
                'asd-2015.05.24',
                'asd-2015.05.25',
                'asd-2015.05.26',
                'asd-2015.05.27',
                'asd-2015.05.28',
                'asd-2015.05.29',
            ];
            expect(pattern.getIndexList(undefined, to)).toEqual(expected);
        });
    });
});
//# sourceMappingURL=index_pattern.test.js.map