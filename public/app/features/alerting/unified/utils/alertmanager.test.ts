import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { parseMatcher, stringifyMatcher } from './alertmanager';

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
});
