import sinon, { SinonFakeTimers } from 'sinon';
import each from 'lodash/each';

import * as dateMath from './datemath';
import { dateTime, DurationUnit, DateTime } from './moment_wrapper';

describe('DateMath', () => {
  const spans: DurationUnit[] = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];
  const anchor = '2014-01-01T06:06:06.666Z';
  const unix = dateTime(anchor).valueOf();
  const format = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
  let clock: SinonFakeTimers;

  describe('errors', () => {
    it('should return undefined if passed empty string', () => {
      expect(dateMath.parse('')).toBe(undefined);
    });

    it('should return undefined if I pass an operator besides [+-/]', () => {
      expect(dateMath.parse('now&1d')).toBe(undefined);
    });

    it('should return undefined if I pass a unit besides' + spans.toString(), () => {
      expect(dateMath.parse('now+5f')).toBe(undefined);
    });

    it('should return undefined if rounding unit is not 1', () => {
      expect(dateMath.parse('now/2y')).toBe(undefined);
      expect(dateMath.parse('now/0.5y')).toBe(undefined);
    });

    it('should not go into an infinite loop when missing a unit', () => {
      expect(dateMath.parse('now-0')).toBe(undefined);
      expect(dateMath.parse('now-00')).toBe(undefined);
    });
  });

  it('now/d should set to start of current day', () => {
    const expected = new Date();
    expected.setHours(0);
    expected.setMinutes(0);
    expected.setSeconds(0);
    expected.setMilliseconds(0);

    const startOfDay = dateMath.parse('now/d', false)!.valueOf();
    expect(startOfDay).toBe(expected.getTime());
  });

  it('now/d on a utc dashboard should be start of the current day in UTC time', () => {
    const today = new Date();
    const expected = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    const startOfDay = dateMath.parse('now/d', false, 'utc')!.valueOf();
    expect(startOfDay).toBe(expected.getTime());
  });

  describe('subtraction', () => {
    let now: DateTime;
    let anchored: DateTime;

    beforeEach(() => {
      clock = sinon.useFakeTimers(unix);
      now = dateTime();
      anchored = dateTime(anchor);
    });

    each(spans, span => {
      const nowEx = 'now-5' + span;
      const thenEx = anchor + '||-5' + span;

      it('should return 5' + span + ' ago', () => {
        expect(dateMath.parse(nowEx)!.format(format)).toEqual(now.subtract(5, span).format(format));
      });

      it('should return 5' + span + ' before ' + anchor, () => {
        expect(dateMath.parse(thenEx)!.format(format)).toEqual(anchored.subtract(5, span).format(format));
      });
    });

    afterEach(() => {
      clock.restore();
    });
  });

  describe('rounding', () => {
    let now: DateTime;

    beforeEach(() => {
      clock = sinon.useFakeTimers(unix);
      now = dateTime();
    });

    each(spans, span => {
      it('should round now to the beginning of the ' + span, () => {
        expect(dateMath.parse('now/' + span)!.format(format)).toEqual(now.startOf(span).format(format));
      });

      it('should round now to the end of the ' + span, () => {
        expect(dateMath.parse('now/' + span, true)!.format(format)).toEqual(now.endOf(span).format(format));
      });
    });

    afterEach(() => {
      clock.restore();
    });
  });

  describe('isValid', () => {
    it('should return false when invalid date text', () => {
      expect(dateMath.isValid('asd')).toBe(false);
    });
    it('should return true when valid date text', () => {
      expect(dateMath.isValid('now-1h')).toBe(true);
    });
  });

  describe('relative time to date parsing', () => {
    it('should handle negative time', () => {
      const date = dateMath.parseDateMath('-2d', dateTime([2014, 1, 5]));
      expect(date!.valueOf()).toEqual(dateTime([2014, 1, 3]).valueOf());
    });

    it('should handle multiple math expressions', () => {
      const date = dateMath.parseDateMath('-2d-6h', dateTime([2014, 1, 5]));
      expect(date!.valueOf()).toEqual(dateTime([2014, 1, 2, 18]).valueOf());
    });

    it('should return false when invalid expression', () => {
      const date = dateMath.parseDateMath('2', dateTime([2014, 1, 5]));
      expect(date).toEqual(undefined);
    });

    it('should strip whitespace from string', () => {
      const date = dateMath.parseDateMath(' - 2d', dateTime([2014, 1, 5]));
      expect(date!.valueOf()).toEqual(dateTime([2014, 1, 3]).valueOf());
    });
  });
});
