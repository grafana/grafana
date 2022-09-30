import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { mockPromAlert } from '../mocks';

import { getMatcherQueryParams, findAlertInstancesWithMatchers, parseQueryParamMatchers } from './matchers';

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

  describe('matchLabelsToMatchers', () => {
    it('should match for equal', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.equal }];
      const alerts = [mockPromAlert({ labels: { foo: 'bar' } }), mockPromAlert({ labels: { foo: 'baz' } })];
      const matchedAlerts = findAlertInstancesWithMatchers(alerts, matchers);

      expect(matchedAlerts).toHaveLength(1);
    });

    it('should match for not equal', () => {
      const matchers = [{ name: 'foo', value: 'bar', operator: MatcherOperator.notEqual }];
      const alerts = [mockPromAlert({ labels: { foo: 'bar' } }), mockPromAlert({ labels: { foo: 'baz' } })];

      const matchedAlerts = findAlertInstancesWithMatchers(alerts, matchers);
      expect(matchedAlerts).toHaveLength(1);
    });

    it('should match for regex', () => {
      const matchers = [{ name: 'foo', value: 'b{1}a.*', operator: MatcherOperator.regex }];
      const alerts = [
        mockPromAlert({ labels: { foo: 'bbr' } }),
        mockPromAlert({ labels: { foo: 'aba' } }), // This does not match because the regex is implicitly anchored.
        mockPromAlert({ labels: { foo: 'ba' } }),
        mockPromAlert({ labels: { foo: 'bar' } }),
        mockPromAlert({ labels: { foo: 'baz' } }),
        mockPromAlert({ labels: { foo: 'bas' } }),
      ];

      const matchedAlerts = findAlertInstancesWithMatchers(alerts, matchers);
      expect(matchedAlerts).toHaveLength(4);
      expect(matchedAlerts.map((instance) => instance.data.matchedInstance.labels.foo)).toEqual([
        'ba',
        'bar',
        'baz',
        'bas',
      ]);
    });

    it('should not match regex', () => {
      const matchers = [{ name: 'foo', value: 'ba{3}', operator: MatcherOperator.notRegex }];
      const alerts = [
        mockPromAlert({ labels: { foo: 'bar' } }),
        mockPromAlert({ labels: { foo: 'baz' } }),
        mockPromAlert({ labels: { foo: 'baaa' } }),
        mockPromAlert({ labels: { foo: 'bas' } }),
      ];

      const matchedAlerts = findAlertInstancesWithMatchers(alerts, matchers);
      expect(matchedAlerts).toHaveLength(3);
      expect(matchedAlerts.map((instance) => instance.data.matchedInstance.labels.foo)).toEqual(['bar', 'baz', 'bas']);
    });
  });
});
