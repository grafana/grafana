import { Matcher, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { parseMatchers, labelsMatchMatchers, removeMuteTimingFromRoute, matchersToString } from './alertmanager';
import { parseMatcher } from './matchers';

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

    // Alertmanager has some strict requirements for label values;
    // we should not automatically encode or decode any values sent
    // and instead let AM return any errors like (matcher value contains unescaped double quote: bar"baz")
    // and allow the user to update the values to the correct format
    //
    // see https://github.com/prometheus/alertmanager/blob/4030e3670b359b8814aa8340ea1144f32b1f5ab3/pkg/labels/parse.go#L55-L99
    // and https://github.com/prometheus/alertmanager/blob/4030e3670b359b8814aa8340ea1144f32b1f5ab3/pkg/labels/parse.go#L101-L178
    it('should not parse escaped values', () => {
      expect(parseMatcher('foo="^[a-z0-9-]{1}[a-z0-9-]{0,30}$"')).toEqual<Matcher>({
        name: 'foo',
        value: '"^[a-z0-9-]{1}[a-z0-9-]{0,30}$"',
        isRegex: false,
        isEqual: true,
      });
      expect(parseMatcher('foo=~bar\\"baz\\"')).toEqual<Matcher>({
        name: 'foo',
        value: 'bar\\"baz\\"',
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

    it('should parse with spaces and brackets', () => {
      expect(parseMatchers('{ foo=bar }')).toEqual<Matcher[]>([
        {
          name: 'foo',
          value: 'bar',
          isRegex: false,
          isEqual: true,
        },
      ]);
    });

    it('should parse with spaces in the value', () => {
      expect(parseMatchers('foo=bar bazz')).toEqual<Matcher[]>([
        {
          name: 'foo',
          value: 'bar bazz',
          isRegex: false,
          isEqual: true,
        },
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

  describe('matchersToString', () => {
    it('Should create a comma-separated list of labels and values wrapped into curly brackets', () => {
      const matchers: Matcher[] = [
        { name: 'severity', value: 'critical', isEqual: true, isRegex: false },
        { name: 'resource', value: 'cpu', isEqual: true, isRegex: true },
        { name: 'rule_uid', value: '2Otf8canzz', isEqual: false, isRegex: false },
        { name: 'cluster', value: 'prom', isEqual: false, isRegex: true },
      ];

      const matchersString = matchersToString(matchers);

      expect(matchersString).toBe('{severity="critical",resource=~"cpu",rule_uid!="2Otf8canzz",cluster!~"prom"}');
    });
  });
});
