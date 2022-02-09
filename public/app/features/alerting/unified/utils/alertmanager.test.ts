import { Matcher, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';
import { parseMatcher, parseMatchers, labelsMatchMatchers, removeMuteTimingFromRoute } from './alertmanager';

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

    it('should parse matchers for key with special characters', () => {
      expect(parseMatchers('foo.bar-baz="bar",baz-bar.foo=bazz')).toEqual<Matcher[]>([
        { name: 'foo.bar-baz', value: 'bar', isRegex: false, isEqual: true },
        { name: 'baz-bar.foo', value: 'bazz', isEqual: true, isRegex: false },
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

  describe('removeMuteTimingFromRoute', () => {
    const route: Route = {
      receiver: 'gmail',
      object_matchers: [['foo', MatcherOperator.equal, 'bar']],
      mute_time_intervals: ['test1', 'test2'],
      routes: [
        {
          receiver: 'slack',
          object_matchers: [['env', MatcherOperator.equal, 'prod']],
          mute_time_intervals: ['test2'],
        },
        {
          receiver: 'pagerduty',
          object_matchers: [['env', MatcherOperator.equal, 'eu']],
          mute_time_intervals: ['test1'],
        },
      ],
    };

    it('should remove mute timings from routes', () => {
      expect(removeMuteTimingFromRoute('test1', route)).toEqual({
        mute_time_intervals: ['test2'],
        object_matchers: [['foo', '=', 'bar']],
        receiver: 'gmail',
        routes: [
          {
            mute_time_intervals: ['test2'],
            object_matchers: [['env', '=', 'prod']],
            receiver: 'slack',
            routes: undefined,
          },
          {
            mute_time_intervals: [],
            object_matchers: [['env', '=', 'eu']],
            receiver: 'pagerduty',
            routes: undefined,
          },
        ],
      });
    });
  });
});
