import { mockCombinedCloudRuleNamespace, mockCombinedRule } from '../mocks';

import { GRAFANA_FOLDER_LABEL, MATCHER_ALERT_RULE_UID } from './constants';
import { getEffectiveRuleLabels } from './rules';

describe('getEffectiveRuleLabels', () => {
  describe('Grafana-managed rules', () => {
    it('should include alertname derived from rule name', () => {
      const rule = mockCombinedRule({ name: 'HighCPU' });

      expect(getEffectiveRuleLabels(rule)).toMatchObject({ alertname: 'HighCPU' });
    });

    it('should include grafana_folder derived from namespace name', () => {
      const rule = mockCombinedRule({
        namespace: { name: 'Production', groups: [], rulesSource: 'grafana' },
      });

      expect(getEffectiveRuleLabels(rule)).toMatchObject({ [GRAFANA_FOLDER_LABEL]: 'Production' });
    });

    it('should include __alert_rule_uid__ when rule has a uid', () => {
      const rule = mockCombinedRule({ uid: 'abc123' });

      expect(getEffectiveRuleLabels(rule)).toMatchObject({ [MATCHER_ALERT_RULE_UID]: 'abc123' });
    });

    it('should not include __alert_rule_uid__ when rule uid is undefined', () => {
      const rule = mockCombinedRule({ uid: undefined });

      expect(getEffectiveRuleLabels(rule)).not.toHaveProperty(MATCHER_ALERT_RULE_UID);
    });

    it('should preserve user-defined labels alongside system labels', () => {
      const rule = mockCombinedRule({
        name: 'HighCPU',
        labels: { severity: 'critical', team: 'ops' },
        namespace: { name: 'Production', groups: [], rulesSource: 'grafana' },
      });

      expect(getEffectiveRuleLabels(rule)).toMatchObject({
        alertname: 'HighCPU',
        [GRAFANA_FOLDER_LABEL]: 'Production',
        severity: 'critical',
        team: 'ops',
      });
    });

    it('should let user-defined labels override system labels when they conflict', () => {
      const rule = mockCombinedRule({
        name: 'HighCPU',
        // user explicitly overrides the alertname system label
        labels: { alertname: 'custom-override' },
      });

      expect(getEffectiveRuleLabels(rule).alertname).toBe('custom-override');
    });

    it('should work with default mock values', () => {
      const rule = mockCombinedRule();

      const result = getEffectiveRuleLabels(rule);
      expect(result.alertname).toBe('mockRule');
      expect(result[GRAFANA_FOLDER_LABEL]).toBe('mockCombinedNamespace');
    });
  });

  describe('non-Grafana rules sources', () => {
    it('should return only user-defined labels without system labels', () => {
      const rule = mockCombinedRule({
        name: 'CloudAlert',
        labels: { severity: 'warning' },
        namespace: mockCombinedCloudRuleNamespace({ name: 'prometheus-ns' }, 'Prometheus'),
      });

      const result = getEffectiveRuleLabels(rule);

      expect(result).toEqual({ severity: 'warning' });
      expect(result).not.toHaveProperty('alertname');
      expect(result).not.toHaveProperty(GRAFANA_FOLDER_LABEL);
      expect(result).not.toHaveProperty(MATCHER_ALERT_RULE_UID);
    });

    it('should return empty labels for a cloud rule with no user-defined labels', () => {
      const rule = mockCombinedRule({
        labels: {},
        namespace: mockCombinedCloudRuleNamespace({}, 'Prometheus'),
      });

      expect(getEffectiveRuleLabels(rule)).toEqual({});
    });
  });
});
