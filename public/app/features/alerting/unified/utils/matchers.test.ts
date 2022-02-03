import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { getMatcherQueryParams, findAlertRulesWithMatchers, parseQueryParamMatchers } from './matchers';
import { mockCombinedRule } from '../mocks';

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

    it('Should create one matcher, using the first occurence when duplicated labels exists', () => {
      const matchers = parseQueryParamMatchers(['alertname=TestData 1', 'alertname=TestData 2']);

      expect(matchers).toHaveLength(1);
      expect(matchers[0].name).toBe('alertname');
      expect(matchers[0].value).toBe('TestData 1');
    });
  });

  describe('matchLabelsToMatchers', () => {
    it('should match for equal', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.equal }];
      const rules = [mockCombinedRule({ labels: { foo: 'bar' } }), mockCombinedRule({ labels: { foo: 'baz' } })];
      const matchedRules = findAlertRulesWithMatchers(rules, matchers);

      expect(matchedRules).toHaveLength(1);
    });

    it('should match for not equal', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.notEqual }];
      const rules = [mockCombinedRule({ labels: { foo: 'bar' } }), mockCombinedRule({ labels: { foo: 'baz' } })];

      const matchedRules = findAlertRulesWithMatchers(rules, matchers);
      expect(matchedRules).toHaveLength(1);
    });

    it('should match for regex', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.regex }];
      const rules = [
        mockCombinedRule({ labels: { foo: 'bar' } }),
        mockCombinedRule({ labels: { foo: 'baz' } }),
        mockCombinedRule({ labels: { foo: 'bas' } }),
      ];

      const matchedRules = findAlertRulesWithMatchers(rules, matchers);
      expect(matchedRules).toHaveLength(1);
    });

    it('should not match regex', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.notRegex }];
      const rules = [
        mockCombinedRule({ labels: { foo: 'bar' } }),
        mockCombinedRule({ labels: { foo: 'baz' } }),
        mockCombinedRule({ labels: { foo: 'bas' } }),
      ];

      const matchedRules = findAlertRulesWithMatchers(rules, matchers);
      expect(matchedRules).toHaveLength(2);
    });
  });
});
