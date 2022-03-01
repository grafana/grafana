import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';
import { parseMatcher, parseMatchers, labelsMatchMatchers } from './alertmanager';

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
