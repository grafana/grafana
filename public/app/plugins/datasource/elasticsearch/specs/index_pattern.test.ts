///<amd-dependency path="test/specs/helpers" name="helpers" />

import { IndexPattern } from '../index_pattern';
import { toUtc, getLocale, setLocale } from '@grafana/data';

describe('IndexPattern', () => {
  const originalLocale = getLocale();
  afterEach(() => setLocale(originalLocale));

  describe('when getting index for today', () => {
    test('should return correct index name', () => {
      const pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
      const expected = 'asd-' + toUtc().format('YYYY.MM.DD');

      expect(pattern.getIndexForToday()).toBe(expected);
    });

    test('should format date using western arabic numerals regardless of locale', () => {
      setLocale('ar_SA'); // saudi-arabic, formatting for YYYY.MM.DD looks like "٢٠٢٠.٠٩.٠٣"
      const pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
      const expected =
        'asd-' +
        toUtc()
          .locale('en')
          .format('YYYY.MM.DD');
      expect(pattern.getIndexForToday()).toBe(expected);
    });
  });

  describe('when getting index list for time range', () => {
    describe('no interval', () => {
      test('should return correct index', () => {
        const pattern = new IndexPattern('my-metrics');
        const from = new Date(2015, 4, 30, 1, 2, 3);
        const to = new Date(2015, 5, 1, 12, 5, 6);
        expect(pattern.getIndexList(from, to)).toEqual('my-metrics');
      });
    });

    describe('daily', () => {
      test('should return correct index list', () => {
        const pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
        const from = new Date(1432940523000);
        const to = new Date(1433153106000);

        const expected = ['asd-2015.05.29', 'asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01'];

        expect(pattern.getIndexList(from, to)).toEqual(expected);
      });

      test('should format date using western arabic numerals regardless of locale', () => {
        setLocale('ar_SA'); // saudi-arabic, formatting for YYYY.MM.DD looks like "٢٠٢٠.٠٩.٠٣"
        const pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
        const from = new Date(1432940523000);
        const to = new Date(1433153106000);

        const expected = ['asd-2015.05.29', 'asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01'];

        expect(pattern.getIndexList(from, to)).toEqual(expected);
      });
    });
  });
});
