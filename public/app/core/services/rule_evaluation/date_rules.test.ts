import { wrap, is, isBefore, isAfter, getDateRules } from './date_rules';
import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';

describe('wrap', () => {
  it('should require input', () => {
    const evaluate = wrap(() => {
      return true;
    });
    const res = evaluate(null, null);
    expect(res).toBeFalsy();
  });

  it('should convert input and parameters to moment', () => {
    const now = moment.utc().valueOf();
    const evaluate = wrap((input: moment.Moment, from: moment.Moment, to: moment.Moment) => {
      expect(input.valueOf()).toBe(now);
      expect(from.valueOf()).toBe(
        moment
          .utc(now)
          .startOf('day')
          .valueOf()
      );
      expect(to.valueOf()).toBe(
        moment
          .utc(now)
          .endOf('day')
          .valueOf()
      );
      return true;
    });
    const res = evaluate(now, ['now/d', 'now/d', 'utc']);
    expect(res).toBeTruthy();
  });

  it('should convert input and absolute parameters to moment', () => {
    const now = moment
      .utc()
      .startOf('second')
      .valueOf();
    const evaluate = wrap((input: moment.Moment, from: moment.Moment, to: moment.Moment) => {
      expect(input.valueOf()).toBe(now);
      expect(from.valueOf()).toBe(now);
      expect(to.valueOf()).toBe(now);
      return true;
    });

    const res = evaluate(now, [moment.utc(now).format(), moment.utc(now).format(), 'utc']);
    expect(res).toBeTruthy();
  });
});

describe('is', () => {
  it('should return true when from date is today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = is(moment(), from, to);
    expect(res).toBeTruthy();
  });

  it('should return true when input date is equal absolute date', () => {
    const from = moment();
    const to = moment(from);
    const res = is(moment(from), from, to);
    expect(res).toBeTruthy();
  });

  it('should return false when input date is not today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = is(moment().subtract(2, 'days'), from, to);
    expect(res).toBeFalsy();
  });

  it('should return false when input date is not equal absolute date', () => {
    const from = moment();
    const to = moment();
    const res = is(moment().add(1, 'seconds'), from, to);
    expect(res).toBeFalsy();
  });
});

describe('is before', () => {
  it('should return true when input date is before today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = isBefore(moment().subtract(2, 'days'), from, to);
    expect(res).toBeTruthy();
  });

  it('should return true when input date is before absolute date', () => {
    const from = moment();
    const to = moment();
    const res = isBefore(moment().subtract(1, 'seconds'), from, to);
    expect(res).toBeTruthy();
  });

  it('should return false when input date is not before today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = isBefore(moment(), from, to);
    expect(res).toBeFalsy();
  });

  it('should return false when input date is not before absolute date', () => {
    const from = moment();
    const to = moment();
    const res = isBefore(moment(), from, to);
    expect(res).toBeFalsy();
  });
});

describe('is after', () => {
  it('should return true when input date is after today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = isAfter(moment().add(2, 'days'), from, to);
    expect(res).toBeTruthy();
  });

  it('should return true when input date is after absolute date', () => {
    const from = moment();
    const to = moment();
    const res = isAfter(moment().add(1, 'seconds'), from, to);
    expect(res).toBeTruthy();
  });

  it('should return false when input date is not after today', () => {
    const from = dateMath.parse('now/d', false);
    const to = dateMath.parse('now/d', true);
    const res = isAfter(moment(), from, to);
    expect(res).toBeFalsy();
  });

  it('should return false when input date is not after absolute date', () => {
    const from = moment();
    const to = moment();
    const res = isAfter(moment(), from, to);
    expect(res).toBeFalsy();
  });
});

describe('getDateRules', () => {
  it('should return date rules', () => {
    const res = getDateRules();
    expect(res.length).toBeGreaterThan(0);
  });
});
