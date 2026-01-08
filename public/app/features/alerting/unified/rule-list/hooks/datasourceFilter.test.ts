import { PromAlertingRuleState, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { getFilter } from '../../utils/search';

import { getDatasourceFilter } from './datasourceFilter';

jest.mock('../../utils/datasource');

const getDatasourceAPIUidMock = jest.mocked(getDatasourceAPIUid);

getDatasourceAPIUidMock.mockImplementation((ruleSourceName) => {
  if (ruleSourceName === 'prometheus') {
    return 'datasource-uid-1';
  }
  if (ruleSourceName === 'loki') {
    return 'datasource-uid-3';
  }
  throw new Error(`Unknown datasource name: ${ruleSourceName}`);
});

describe('datasource-managed rules', () => {
  describe('groupFilter', () => {
    it('should filter by namespace (file path)', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { groupMatches } = getDatasourceFilter(getFilter({ namespace: 'production' }));
      expect(groupMatches(group)).toBe(true);

      const { groupMatches: groupMatches2 } = getDatasourceFilter(getFilter({ namespace: 'staging' }));
      expect(groupMatches2(group)).toBe(false);
    });

    it('should filter by group name', () => {
      const group: PromRuleGroupDTO = {
        name: 'CPU Usage Alerts',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { groupMatches } = getDatasourceFilter(getFilter({ groupName: 'cpu' }));
      expect(groupMatches(group)).toBe(true);

      const { groupMatches: groupMatches2 } = getDatasourceFilter(getFilter({ groupName: 'memory' }));
      expect(groupMatches2(group)).toBe(false);
    });

    it('should return true when no filters are applied', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { groupMatches } = getDatasourceFilter(getFilter({}));
      expect(groupMatches(group)).toBe(true);
    });
  });

  describe('ruleFilter', () => {
    it('should filter by free form words in rule name', () => {
      const rule = mockPromAlertingRule({ name: 'High CPU Usage' });

      const { ruleMatches } = getDatasourceFilter(getFilter({ freeFormWords: ['cpu'] }));
      expect(ruleMatches(rule)).toBe(true);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ freeFormWords: ['memory'] }));
      expect(ruleMatches2(rule)).toBe(false);
    });

    it('should filter by rule name', () => {
      const rule = mockPromAlertingRule({ name: 'High CPU Usage' });

      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleName: 'cpu' }));
      expect(ruleMatches(rule)).toBe(true);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ ruleName: 'memory' }));
      expect(ruleMatches2(rule)).toBe(false);
    });

    it('should filter by labels', () => {
      const rule = mockPromAlertingRule({
        labels: { severity: 'critical', team: 'ops' },
        alerts: [],
      });

      const { ruleMatches } = getDatasourceFilter(getFilter({ labels: ['severity=critical'] }));
      expect(ruleMatches(rule)).toBe(true);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ labels: ['severity=warning'] }));
      expect(ruleMatches2(rule)).toBe(false);

      const { ruleMatches: ruleMatches3 } = getDatasourceFilter(getFilter({ labels: ['team=ops'] }));
      expect(ruleMatches3(rule)).toBe(true);
    });

    it('should filter by alert instance labels', () => {
      const rule = mockPromAlertingRule({
        labels: { severity: 'critical' },
        alerts: [
          {
            labels: { instance: 'server-1', env: 'production' },
            state: PromAlertingRuleState.Firing,
            value: '100',
            activeAt: '',
            annotations: {},
          },
        ],
      });

      const { ruleMatches } = getDatasourceFilter(getFilter({ labels: ['instance=server-1'] }));
      expect(ruleMatches(rule)).toBe(true);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ labels: ['env=production'] }));
      expect(ruleMatches2(rule)).toBe(true);

      const { ruleMatches: ruleMatches3 } = getDatasourceFilter(getFilter({ labels: ['instance=server-2'] }));
      expect(ruleMatches3(rule)).toBe(false);
    });

    it('should filter by rule type', () => {
      const alertingRule = mockPromAlertingRule({ name: 'Test Alert' });
      const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleType: PromRuleType.Alerting }));
      expect(ruleMatches(alertingRule)).toBe(true);
      expect(ruleMatches(recordingRule)).toBe(false);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ ruleType: PromRuleType.Recording }));
      expect(ruleMatches2(alertingRule)).toBe(false);
      expect(ruleMatches2(recordingRule)).toBe(true);
    });

    it('should filter by rule state', () => {
      const firingRule = mockPromAlertingRule({
        name: 'Firing Alert',
        state: PromAlertingRuleState.Firing,
      });

      const pendingRule = mockPromAlertingRule({
        name: 'Pending Alert',
        state: PromAlertingRuleState.Pending,
      });

      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleState: PromAlertingRuleState.Firing }));
      expect(ruleMatches(firingRule)).toBe(true);
      expect(ruleMatches(pendingRule)).toBe(false);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(
        getFilter({ ruleState: PromAlertingRuleState.Pending })
      );
      expect(ruleMatches2(firingRule)).toBe(false);
      expect(ruleMatches2(pendingRule)).toBe(true);
    });

    it('should filter out recording rules when filtering by rule state', () => {
      const recordingRule = mockPromRecordingRule({
        name: 'Recording Rule',
      });

      // Recording rules should always be filtered out when any rule state filter is applied as they don't have a state
      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleState: PromAlertingRuleState.Firing }));
      expect(ruleMatches(recordingRule)).toBe(false);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(
        getFilter({ ruleState: PromAlertingRuleState.Pending })
      );
      expect(ruleMatches2(recordingRule)).toBe(false);

      const { ruleMatches: ruleMatches3 } = getDatasourceFilter(
        getFilter({ ruleState: PromAlertingRuleState.Inactive })
      );
      expect(ruleMatches3(recordingRule)).toBe(false);
    });

    it('should filter by rule health', () => {
      const healthyRule = mockPromAlertingRule({
        name: 'Healthy Rule',
        health: RuleHealth.Ok,
      });

      const errorRule = mockPromAlertingRule({
        name: 'Error Rule',
        health: RuleHealth.Error,
      });

      const prometheusErrorRule = mockPromAlertingRule({
        name: 'Error Rule',
        health: 'err',
      });

      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleHealth: RuleHealth.Ok }));
      expect(ruleMatches(healthyRule)).toBe(true);
      expect(ruleMatches(errorRule)).toBe(false);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ ruleHealth: RuleHealth.Error }));
      expect(ruleMatches2(healthyRule)).toBe(false);
      expect(ruleMatches2(errorRule)).toBe(true);
      expect(ruleMatches2(prometheusErrorRule)).toBe(true);
    });

    it('should normalize health values when filtering', () => {
      // Legacy Prometheus health value 'err' should be normalized to 'error'
      const legacyErrorRule = mockPromAlertingRule({
        name: 'Legacy Error Rule',
        health: 'err',
      });

      // When filtering for 'error', it should match rules with health 'err' (legacy) or 'error'
      const { ruleMatches } = getDatasourceFilter(getFilter({ ruleHealth: RuleHealth.Error }));
      expect(ruleMatches(legacyErrorRule)).toBe(true);
    });

    it('should filter by dashboard UID', () => {
      const ruleDashboardA = mockPromAlertingRule({
        name: 'Dashboard A Rule',
        annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
      });

      const ruleDashboardB = mockPromAlertingRule({
        name: 'Dashboard B Rule',
        annotations: { [Annotation.dashboardUID]: 'dashboard-b' },
      });

      const { ruleMatches } = getDatasourceFilter(getFilter({ dashboardUid: 'dashboard-a' }));
      expect(ruleMatches(ruleDashboardA)).toBe(true);
      expect(ruleMatches(ruleDashboardB)).toBe(false);

      const { ruleMatches: ruleMatches2 } = getDatasourceFilter(getFilter({ dashboardUid: 'dashboard-b' }));
      expect(ruleMatches2(ruleDashboardA)).toBe(false);
      expect(ruleMatches2(ruleDashboardB)).toBe(true);
    });

    it('should filter out recording rules when filtering by dashboard UID', () => {
      const recordingRule = mockPromRecordingRule({
        name: 'Recording Rule',
        // Recording rules cannot have dashboard UIDs because they don't have annotations
      });

      // Dashboard UID filter should filter out recording rules
      const { ruleMatches } = getDatasourceFilter(getFilter({ dashboardUid: 'any-dashboard' }));
      expect(ruleMatches(recordingRule)).toBe(false);
    });

    describe('dataSourceNames filter', () => {
      it('should match rules that use the filtered datasource', () => {
        // Create a Grafana rule with matching datasource
        const ruleWithMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });

        // 'prometheus' resolves to 'datasource-uid-1' which is in the rule
        const { ruleMatches } = getDatasourceFilter(getFilter({ dataSourceNames: ['prometheus'] }));
        expect(ruleMatches(ruleWithMatchingDatasource)).toBe(true);
      });

      it("should filter out rules that don't use the filtered datasource", () => {
        // Create a Grafana rule without the target datasource
        const ruleWithoutMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1', 'datasource-uid-2'],
        });

        // 'loki' resolves to 'datasource-uid-3' which is not in the rule
        const { ruleMatches } = getDatasourceFilter(getFilter({ dataSourceNames: ['loki'] }));
        expect(ruleMatches(ruleWithoutMatchingDatasource)).toBe(false);
      });

      it('should return false when there is an error parsing the query', () => {
        const ruleWithInvalidQuery = mockGrafanaPromAlertingRule({
          query: 'not-valid-json',
        });

        const { ruleMatches } = getDatasourceFilter(getFilter({ dataSourceNames: ['prometheus'] }));
        expect(ruleMatches(ruleWithInvalidQuery)).toBe(false);
      });
    });

    it('should combine multiple filters with AND logic', () => {
      const rule = mockPromAlertingRule({
        name: 'High CPU Usage Production',
        labels: { severity: 'critical', environment: 'production' },
        state: PromAlertingRuleState.Firing,
        health: RuleHealth.Ok,
      });

      const filter = getFilter({
        ruleName: 'cpu',
        labels: ['severity=critical', 'environment=production'],
        ruleState: PromAlertingRuleState.Firing,
        ruleHealth: RuleHealth.Ok,
      });
      const { ruleMatches } = getDatasourceFilter(filter);
      expect(ruleMatches(rule)).toBe(true);
    });

    it('should return false if any filter does not match', () => {
      const rule = mockPromAlertingRule({
        name: 'High CPU Usage Production',
        labels: { severity: 'critical', environment: 'production' },
        state: PromAlertingRuleState.Firing,
        health: RuleHealth.Ok,
        alerts: [],
      });

      const filter = getFilter({
        ruleName: 'cpu',
        labels: ['severity=warning'],
        ruleState: PromAlertingRuleState.Firing,
        ruleHealth: RuleHealth.Ok,
      });
      const { ruleMatches } = getDatasourceFilter(filter);
      expect(ruleMatches(rule)).toBe(false);
    });
  });
});
