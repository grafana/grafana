import { PromAlertingRuleState, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { getFilter } from '../../utils/search';

import { getDatasourceFilter, getGrafanaFilter } from './filters';

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

      const { groupFilter } = getDatasourceFilter();
      expect(groupFilter(group, getFilter({ namespace: 'production' }))).toBe(true);
      expect(groupFilter(group, getFilter({ namespace: 'staging' }))).toBe(false);
    });

    it('should filter by group name', () => {
      const group: PromRuleGroupDTO = {
        name: 'CPU Usage Alerts',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { groupFilter } = getDatasourceFilter();
      expect(groupFilter(group, getFilter({ groupName: 'cpu' }))).toBe(true);
      expect(groupFilter(group, getFilter({ groupName: 'memory' }))).toBe(false);
    });

    it('should return true when no filters are applied', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { groupFilter } = getDatasourceFilter();
      expect(groupFilter(group, getFilter({}))).toBe(true);
    });
  });

  describe('ruleFilter', () => {
    it('should filter by free form words in rule name', () => {
      const rule = mockPromAlertingRule({ name: 'High CPU Usage' });
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(ruleFilter(rule, getFilter({ freeFormWords: ['memory'] }))).toBe(false);
    });

    it('should filter by rule name', () => {
      const rule = mockPromAlertingRule({ name: 'High CPU Usage' });
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, getFilter({ ruleName: 'cpu' }))).toBe(true);
      expect(ruleFilter(rule, getFilter({ ruleName: 'memory' }))).toBe(false);
    });

    it('should filter by labels', () => {
      const rule = mockPromAlertingRule({
        labels: { severity: 'critical', team: 'ops' },
        alerts: [],
      });
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, getFilter({ labels: ['severity=critical'] }))).toBe(true);
      expect(ruleFilter(rule, getFilter({ labels: ['severity=warning'] }))).toBe(false);
      expect(ruleFilter(rule, getFilter({ labels: ['team=ops'] }))).toBe(true);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, getFilter({ labels: ['instance=server-1'] }))).toBe(true);
      expect(ruleFilter(rule, getFilter({ labels: ['env=production'] }))).toBe(true);
      expect(ruleFilter(rule, getFilter({ labels: ['instance=server-2'] }))).toBe(false);
    });

    it('should filter by rule type', () => {
      const alertingRule = mockPromAlertingRule({ name: 'Test Alert' });
      const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(alertingRule, getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      expect(ruleFilter(alertingRule, getFilter({ ruleType: PromRuleType.Recording }))).toBe(false);
      expect(ruleFilter(recordingRule, getFilter({ ruleType: PromRuleType.Recording }))).toBe(true);
      expect(ruleFilter(recordingRule, getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(true);
      expect(ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(false);
      expect(ruleFilter(pendingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(true);
    });

    it('should filter out recording rules when filtering by rule state', () => {
      const recordingRule = mockPromRecordingRule({
        name: 'Recording Rule',
      });
      const { ruleFilter } = getDatasourceFilter();

      // Recording rules should always be filtered out when any rule state filter is applied as they don't have a state
      expect(ruleFilter(recordingRule, getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
      expect(ruleFilter(recordingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(false);
      expect(ruleFilter(recordingRule, getFilter({ ruleState: PromAlertingRuleState.Inactive }))).toBe(false);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(true);
      expect(ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(false);
      expect(ruleFilter(errorRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
      expect(ruleFilter(prometheusErrorRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
    });

    it('should normalize health values when filtering', () => {
      // Legacy Prometheus health value 'err' should be normalized to 'error'
      const legacyErrorRule = mockPromAlertingRule({
        name: 'Legacy Error Rule',
        health: 'err',
      });
      const { ruleFilter } = getDatasourceFilter();

      // When filtering for 'error', it should match rules with health 'err' (legacy) or 'error'
      expect(ruleFilter(legacyErrorRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-a' }))).toBe(true);
      expect(ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(false);
      expect(ruleFilter(ruleDashboardB, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(true);
    });

    it('should filter out recording rules when filtering by dashboard UID', () => {
      const recordingRule = mockPromRecordingRule({
        name: 'Recording Rule',
        // Recording rules cannot have dashboard UIDs because they don't have annotations
      });
      const { ruleFilter } = getDatasourceFilter();

      // Dashboard UID filter should filter out recording rules
      expect(ruleFilter(recordingRule, getFilter({ dashboardUid: 'any-dashboard' }))).toBe(false);
    });

    describe('dataSourceNames filter', () => {
      it('should match rules that use the filtered datasource', () => {
        // Create a Grafana rule with matching datasource
        const ruleWithMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });
        const { ruleFilter } = getDatasourceFilter();

        // 'prometheus' resolves to 'datasource-uid-1' which is in the rule
        expect(ruleFilter(ruleWithMatchingDatasource, getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
      });

      it("should filter out rules that don't use the filtered datasource", () => {
        // Create a Grafana rule without the target datasource
        const ruleWithoutMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1', 'datasource-uid-2'],
        });
        const { ruleFilter } = getDatasourceFilter();

        // 'loki' resolves to 'datasource-uid-3' which is not in the rule
        expect(ruleFilter(ruleWithoutMatchingDatasource, getFilter({ dataSourceNames: ['loki'] }))).toBe(false);
      });

      it('should return false when there is an error parsing the query', () => {
        const ruleWithInvalidQuery = mockGrafanaPromAlertingRule({
          query: 'not-valid-json',
        });
        const { ruleFilter } = getDatasourceFilter();

        expect(ruleFilter(ruleWithInvalidQuery, getFilter({ dataSourceNames: ['prometheus'] }))).toBe(false);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, filter)).toBe(true);
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
      const { ruleFilter } = getDatasourceFilter();

      expect(ruleFilter(rule, filter)).toBe(false);
    });
  });
});

describe('grafana-managed rules', () => {
  describe('groupFilter', () => {
    it('should filter by namespace (file path)', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({}));
      expect(frontendFilter.groupFilter(group, getFilter({ namespace: 'production' }))).toBe(true);
      expect(frontendFilter.groupFilter(group, getFilter({ namespace: 'staging' }))).toBe(false);
    });

    it('should filter by group name', () => {
      const group: PromRuleGroupDTO = {
        name: 'CPU Usage Alerts',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({}));
      expect(frontendFilter.groupFilter(group, getFilter({ groupName: 'cpu' }))).toBe(true);
      expect(frontendFilter.groupFilter(group, getFilter({ groupName: 'memory' }))).toBe(false);
    });

    it('should return true when no filters are applied', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({}));
      expect(frontendFilter.groupFilter(group, getFilter({}))).toBe(true);
    });
  });

  describe('ruleFilter - frontend filters', () => {
    it('should filter by free form words in rule name', () => {
      const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      expect(frontendFilter.ruleFilter(rule, getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(frontendFilter.ruleFilter(rule, getFilter({ freeFormWords: ['memory'] }))).toBe(false);
    });

    it('should filter by rule name', () => {
      const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      expect(frontendFilter.ruleFilter(rule, getFilter({ ruleName: 'cpu' }))).toBe(true);
      expect(frontendFilter.ruleFilter(rule, getFilter({ ruleName: 'memory' }))).toBe(false);
    });

    it('should filter by labels', () => {
      const rule = mockGrafanaPromAlertingRule({
        labels: { severity: 'critical', team: 'ops' },
        alerts: [],
      });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      expect(frontendFilter.ruleFilter(rule, getFilter({ labels: ['severity=critical'] }))).toBe(true);
      expect(frontendFilter.ruleFilter(rule, getFilter({ labels: ['severity=warning'] }))).toBe(false);
      expect(frontendFilter.ruleFilter(rule, getFilter({ labels: ['team=ops'] }))).toBe(true);
    });

    it('should filter by rule type', () => {
      const alertingRule = mockGrafanaPromAlertingRule({ name: 'Test Alert' });
      const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      expect(frontendFilter.ruleFilter(alertingRule, getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      expect(frontendFilter.ruleFilter(alertingRule, getFilter({ ruleType: PromRuleType.Recording }))).toBe(false);
      expect(frontendFilter.ruleFilter(recordingRule, getFilter({ ruleType: PromRuleType.Recording }))).toBe(true);
      expect(frontendFilter.ruleFilter(recordingRule, getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
    });

    it('should filter by dashboard UID', () => {
      const ruleDashboardA = mockGrafanaPromAlertingRule({
        name: 'Dashboard A Rule',
        annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
      });

      const ruleDashboardB = mockGrafanaPromAlertingRule({
        name: 'Dashboard B Rule',
        annotations: { [Annotation.dashboardUID]: 'dashboard-b' },
      });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      expect(frontendFilter.ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-a' }))).toBe(true);
      expect(frontendFilter.ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(false);
      expect(frontendFilter.ruleFilter(ruleDashboardB, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(true);
    });

    describe('dataSourceNames filter', () => {
      it('should match rules that use the filtered datasource', () => {
        const ruleWithMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });
        const { frontendFilter } = getGrafanaFilter(getFilter({}));

        expect(
          frontendFilter.ruleFilter(ruleWithMatchingDatasource, getFilter({ dataSourceNames: ['prometheus'] }))
        ).toBe(true);
      });

      it("should filter out rules that don't use the filtered datasource", () => {
        const ruleWithoutMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1', 'datasource-uid-2'],
        });
        const { frontendFilter } = getGrafanaFilter(getFilter({}));

        expect(frontendFilter.ruleFilter(ruleWithoutMatchingDatasource, getFilter({ dataSourceNames: ['loki'] }))).toBe(
          false
        );
      });
    });
  });

  describe('ruleFilter - backend filters (should NOT be applied in frontend)', () => {
    it('should NOT filter by rule state in frontend (returns true regardless)', () => {
      const firingRule = mockGrafanaPromAlertingRule({
        name: 'Firing Alert',
        state: PromAlertingRuleState.Firing,
      });

      const pendingRule = mockGrafanaPromAlertingRule({
        name: 'Pending Alert',
        state: PromAlertingRuleState.Pending,
      });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      // Frontend filter should return true for all states since backend handles this
      expect(frontendFilter.ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(true);
      expect(frontendFilter.ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(true);
      expect(frontendFilter.ruleFilter(pendingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(
        true
      );
      expect(frontendFilter.ruleFilter(pendingRule, getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(true);
    });

    it('should NOT filter by rule health in frontend (returns true regardless)', () => {
      const healthyRule = mockGrafanaPromAlertingRule({
        name: 'Healthy Rule',
        health: RuleHealth.Ok,
      });

      const errorRule = mockGrafanaPromAlertingRule({
        name: 'Error Rule',
        health: RuleHealth.Error,
      });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      // Frontend filter should return true for all health states since backend handles this
      expect(frontendFilter.ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(true);
      expect(frontendFilter.ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
      expect(frontendFilter.ruleFilter(errorRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
      expect(frontendFilter.ruleFilter(errorRule, getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(true);
    });

    it('should NOT filter by contact point in frontend (returns true regardless)', () => {
      const ruleWithContactPoint = mockGrafanaPromAlertingRule({
        name: 'Rule with Contact Point',
        notificationSettings: {
          receiver: 'contact-point-1',
        },
      });

      const ruleWithDifferentContactPoint = mockGrafanaPromAlertingRule({
        name: 'Rule with Different Contact Point',
        notificationSettings: {
          receiver: 'contact-point-2',
        },
      });
      const { frontendFilter } = getGrafanaFilter(getFilter({}));

      // Frontend filter should return true for all contact points since backend handles this
      expect(frontendFilter.ruleFilter(ruleWithContactPoint, getFilter({ contactPoint: 'contact-point-1' }))).toBe(
        true
      );
      expect(frontendFilter.ruleFilter(ruleWithContactPoint, getFilter({ contactPoint: 'contact-point-2' }))).toBe(
        true
      );
      expect(
        frontendFilter.ruleFilter(ruleWithDifferentContactPoint, getFilter({ contactPoint: 'contact-point-1' }))
      ).toBe(true);
      expect(
        frontendFilter.ruleFilter(ruleWithDifferentContactPoint, getFilter({ contactPoint: 'contact-point-2' }))
      ).toBe(true);
    });
  });

  describe('backendFilter', () => {
    it('should include ruleState in backend filter', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({ ruleState: PromAlertingRuleState.Firing }));

      expect(backendFilter.state).toEqual([PromAlertingRuleState.Firing]);
    });

    it('should include ruleHealth in backend filter', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({ ruleHealth: RuleHealth.Error }));

      expect(backendFilter.health).toEqual([RuleHealth.Error]);
    });

    it('should include contactPoint in backend filter', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({ contactPoint: 'my-contact-point' }));

      expect(backendFilter.contactPoint).toBe('my-contact-point');
    });

    it('should handle empty backend filters', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({}));

      expect(backendFilter.state).toEqual([]);
      expect(backendFilter.health).toEqual([]);
      expect(backendFilter.contactPoint).toBeUndefined();
    });
  });
});
