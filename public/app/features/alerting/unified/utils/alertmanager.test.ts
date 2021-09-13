import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';
import { parseMatcher, parseMatchers, stringifyMatcher, labelsMatchMatchers } from './alertmanager';

describe('Alertmanager utils', () => {
  describe('parseMatcher', () => {
    it('should parse operators correctly', () => {
      expect(parseMatcher('foo=bar')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar',
        isRegex: false,
        isEqual: true,
      });
      expect(parseMatcher('foo!=bar')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar',
        isRegex: false,
        isEqual: false,
      });
      expect(parseMatcher('foo =~bar')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar',
        isRegex: true,
        isEqual: true,
      });
      expect(parseMatcher('foo!~ bar')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar',
        isRegex: true,
        isEqual: false,
      });
    });

    it('should parse escaped values correctly', () => {
      expect(parseMatcher('foo=~"bar\\"baz\\""')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar"baz"',
        isRegex: true,
        isEqual: true,
      });
      expect(parseMatcher('foo=~bar\\"baz\\"')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar"baz"',
        isRegex: true,
        isEqual: true,
      });
    });
    it('should parse multiple operators values correctly', () => {
      expect(parseMatcher('foo=~bar=baz!=bad!~br')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar=baz!=bad!~br',
        isRegex: true,
        isEqual: true,
      });
    });
  });

  describe('stringifyMatcher', () => {
    it('should stringify matcher correctly', () => {
      expect(
        stringifyMatcher({
          name: 'foo',
          value: 'boo="bar"',
          isRegex: true,
          isEqual: false,
        })
      ).toEqual('foo!~"boo=\\"bar\\""');
    });
  });

  describe('parseMatchers', () => {
    it('should parse all operators', () => {
      expect(parseMatchers('foo=bar, bar=~ba.+, severity!=warning, email!~@grafana.com')).toEqual<Matcher[]>([
        { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
        { name: 'bar', value: 'ba.+', isEqual: true, isRegex: true },
        { name: 'severity', value: 'warning', isRegex: false, isEqual: false },
        { name: 'email', value: '@grafana.com', isRegex: true, isEqual: false },
      ]);
    });

    it('should return nothing for invalid operator', () => {
      expect(parseMatchers('foo=!bar')).toEqual([]);
    });

    it('should parse matchers with or without quotes', () => {
      expect(parseMatchers('foo="bar",bar=bazz')).toEqual<Matcher[]>([
        { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
        { name: 'bar', value: 'bazz', isEqual: true, isRegex: false },
      ]);
    });
  });

  describe('labelsMatchMatchers', () => {
    it('should return true for matching labels', () => {
      const labels: Labels = {
        foo: 'bar',
        bar: 'bazz',
        bazz: 'buzz',
      };

      const matchers = parseMatchers('foo=bar,bar=bazz');
      expect(labelsMatchMatchers(labels, matchers)).toBe(true);
    });
    it('should return false for no matching labels', () => {
      const labels: Labels = {
        foo: 'bar',
        bar: 'bazz',
      };
      const matchers = parseMatchers('foo=buzz');
      expect(labelsMatchMatchers(labels, matchers)).toBe(false);
    });
    it('should match with different operators', () => {
      const labels: Labels = {
        foo: 'bar',
        bar: 'bazz',
        email: 'admin@grafana.com',
      };
      const matchers = parseMatchers('foo!=bazz,bar=~ba.+');
      expect(labelsMatchMatchers(labels, matchers)).toBe(true);
    });
  });
});
