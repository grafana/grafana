import { MatcherOperator, Route } from '../../../../plugins/datasource/alertmanager/types';

import { getMatcherQueryParams, normalizeMatchers, parseQueryParamMatchers } from './matchers';

describe('Unified Alerting matchers', () => {
  describe('getMatcherQueryParams tests', () => {
    it('Should create an entry for each label', () => {
      const params = getMatcherQueryParams({ foo: 'bar', alertname: 'TestData - No data', rule_uid: 'YNZBpGJnk' });

      const matcherParams = params.getAll('matcher');

      expect(matcherParams).toHaveLength(3);
      expect(matcherParams).toContain('foo=bar');
      expect(matcherParams).toContain('alertname=TestData - No data');
      expect(matcherParams).toContain('rule_uid=YNZBpGJnk');
    });
  });

  describe('parseQueryParamMatchers tests', () => {
    it('Should create a matcher for each unique label-expression pair', () => {
      const matchers = parseQueryParamMatchers(['alertname=TestData 1', 'rule_uid=YNZBpGJnk']);

      expect(matchers).toHaveLength(2);
      expect(matchers[0].name).toBe('alertname');
      expect(matchers[0].value).toBe('TestData 1');
      expect(matchers[1].name).toBe('rule_uid');
      expect(matchers[1].value).toBe('YNZBpGJnk');
    });

    it('Should create one matcher, using the first occurrence when duplicated labels exists', () => {
      const matchers = parseQueryParamMatchers(['alertname=TestData 1', 'alertname=TestData 2']);

      expect(matchers).toHaveLength(1);
      expect(matchers[0].name).toBe('alertname');
      expect(matchers[0].value).toBe('TestData 1');
    });
  });

  describe('normalizeMatchers', () => {
    const eq = MatcherOperator.equal;

    it('should work for object_matchers', () => {
      const route: Route = { object_matchers: [['foo', eq, 'bar']] };
      expect(normalizeMatchers(route)).toEqual([['foo', eq, 'bar']]);
    });
    it('should work for matchers', () => {
      const route: Route = { matchers: ['foo=bar', 'foo!=bar', 'foo=~bar', 'foo!~bar'] };
      expect(normalizeMatchers(route)).toEqual([
        ['foo', MatcherOperator.equal, 'bar'],
        ['foo', MatcherOperator.notEqual, 'bar'],
        ['foo', MatcherOperator.regex, 'bar'],
        ['foo', MatcherOperator.notRegex, 'bar'],
      ]);
    });
    it('should work for match and match_re', () => {
      const route: Route = { match: { foo: 'bar' }, match_re: { foo: 'bar' } };
      expect(normalizeMatchers(route)).toEqual([
        ['foo', MatcherOperator.regex, 'bar'],
        ['foo', MatcherOperator.equal, 'bar'],
      ]);
    });
  });
});
