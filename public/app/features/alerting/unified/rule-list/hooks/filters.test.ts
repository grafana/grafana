import { testWithFeatureToggles } from 'test/test-utils';

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

describe('grafana-managed rules', () => {
  describe('groupFilter', () => {
    it('should filter by namespace (file path)', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({ namespace: 'production' }));
      expect(frontendFilter.groupMatches(group)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ namespace: 'staging' }));
      expect(frontendFilter2.groupMatches(group)).toBe(false);
    });

    it('should filter by group name', () => {
      const group: PromRuleGroupDTO = {
        name: 'CPU Usage Alerts',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({ groupName: 'cpu' }));
      expect(frontendFilter.groupMatches(group)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ groupName: 'memory' }));
      expect(frontendFilter2.groupMatches(group)).toBe(false);
    });

    it('should return true when no filters are applied', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({}));
      expect(frontendFilter.groupMatches(group)).toBe(true);
    });
  });

  describe('ruleFilter - frontend filters', () => {
    it('should filter by free form words in rule name', () => {
      const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

      const { frontendFilter } = getGrafanaFilter(getFilter({ freeFormWords: ['cpu'] }));
      expect(frontendFilter.ruleMatches(rule)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ freeFormWords: ['memory'] }));
      expect(frontendFilter2.ruleMatches(rule)).toBe(false);
    });

    it('should filter by rule name', () => {
      const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

      const { frontendFilter } = getGrafanaFilter(getFilter({ ruleName: 'cpu' }));
      expect(frontendFilter.ruleMatches(rule)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ ruleName: 'memory' }));
      expect(frontendFilter2.ruleMatches(rule)).toBe(false);
    });

    it('should filter by labels', () => {
      const rule = mockGrafanaPromAlertingRule({
        labels: { severity: 'critical', team: 'ops' },
        alerts: [],
      });

      const { frontendFilter } = getGrafanaFilter(getFilter({ labels: ['severity=critical'] }));
      expect(frontendFilter.ruleMatches(rule)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ labels: ['severity=warning'] }));
      expect(frontendFilter2.ruleMatches(rule)).toBe(false);

      const { frontendFilter: frontendFilter3 } = getGrafanaFilter(getFilter({ labels: ['team=ops'] }));
      expect(frontendFilter3.ruleMatches(rule)).toBe(true);
    });

    it('should filter by rule type', () => {
      const alertingRule = mockGrafanaPromAlertingRule({ name: 'Test Alert' });
      const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

      const { frontendFilter } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Alerting }));
      expect(frontendFilter.ruleMatches(alertingRule)).toBe(true);
      expect(frontendFilter.ruleMatches(recordingRule)).toBe(false);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Recording }));
      expect(frontendFilter2.ruleMatches(alertingRule)).toBe(false);
      expect(frontendFilter2.ruleMatches(recordingRule)).toBe(true);
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

      const { frontendFilter } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-a' }));
      expect(frontendFilter.ruleMatches(ruleDashboardA)).toBe(true);
      expect(frontendFilter.ruleMatches(ruleDashboardB)).toBe(false);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-b' }));
      expect(frontendFilter2.ruleMatches(ruleDashboardA)).toBe(false);
      expect(frontendFilter2.ruleMatches(ruleDashboardB)).toBe(true);
    });

    describe('dataSourceNames filter', () => {
      it('should match rules that use the filtered datasource', () => {
        const ruleWithMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });

        const { frontendFilter } = getGrafanaFilter(getFilter({ dataSourceNames: ['prometheus'] }));
        expect(frontendFilter.ruleMatches(ruleWithMatchingDatasource)).toBe(true);
      });

      it("should filter out rules that don't use the filtered datasource", () => {
        const ruleWithoutMatchingDatasource = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1', 'datasource-uid-2'],
        });

        const { frontendFilter } = getGrafanaFilter(getFilter({ dataSourceNames: ['loki'] }));
        expect(frontendFilter.ruleMatches(ruleWithoutMatchingDatasource)).toBe(false);
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

      // Frontend filter should return true for all states since backend handles this
      const { frontendFilter } = getGrafanaFilter(getFilter({ ruleState: PromAlertingRuleState.Firing }));
      expect(frontendFilter.ruleMatches(firingRule)).toBe(true);
      expect(frontendFilter.ruleMatches(pendingRule)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(
        getFilter({ ruleState: PromAlertingRuleState.Pending })
      );
      expect(frontendFilter2.ruleMatches(firingRule)).toBe(true);
      expect(frontendFilter2.ruleMatches(pendingRule)).toBe(true);
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

      // Frontend filter should return true for all health states since backend handles this
      const { frontendFilter } = getGrafanaFilter(getFilter({ ruleHealth: RuleHealth.Ok }));
      expect(frontendFilter.ruleMatches(healthyRule)).toBe(true);
      expect(frontendFilter.ruleMatches(errorRule)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ ruleHealth: RuleHealth.Error }));
      expect(frontendFilter2.ruleMatches(healthyRule)).toBe(true);
      expect(frontendFilter2.ruleMatches(errorRule)).toBe(true);
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

      // Frontend filter should return true for all contact points since backend handles this
      const { frontendFilter } = getGrafanaFilter(getFilter({ contactPoint: 'contact-point-1' }));
      expect(frontendFilter.ruleMatches(ruleWithContactPoint)).toBe(true);
      expect(frontendFilter.ruleMatches(ruleWithDifferentContactPoint)).toBe(true);

      const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ contactPoint: 'contact-point-2' }));
      expect(frontendFilter2.ruleMatches(ruleWithContactPoint)).toBe(true);
      expect(frontendFilter2.ruleMatches(ruleWithDifferentContactPoint)).toBe(true);
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

  describe('backend filtering with alertingUIUseBackendFilters feature toggle', () => {
    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should include title in backend filter when freeFormWords are provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ freeFormWords: ['cpu', 'usage'] }));

        expect(backendFilter.title).toBe('cpu usage');
      });

      it('should include title in backend filter when ruleName is provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ ruleName: 'high cpu' }));

        expect(backendFilter.title).toBe('high cpu');
      });

      it('should combine ruleName and freeFormWords in title', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ ruleName: 'alert', freeFormWords: ['cpu'] }));

        expect(backendFilter.title).toBe('alert cpu');
      });

      it('should not include title when no title filters are provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ ruleState: PromAlertingRuleState.Firing }));

        expect(backendFilter.title).toBeUndefined();
      });

      it('should skip freeFormWords filtering on frontend when backend filtering is enabled', () => {
        const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ freeFormWords: ['memory'] }));
        // Should return true because freeFormWords filter is null (handled by backend)
        expect(frontendFilter.ruleMatches(rule)).toBe(true);
      });

      it('should skip ruleName filtering on frontend when backend filtering is enabled', () => {
        const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ ruleName: 'memory' }));
        // Should return true because ruleName filter is null (handled by backend)
        expect(frontendFilter.ruleMatches(rule)).toBe(true);
      });

      it('should include ruleType in backend filter when provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Alerting }));

        expect(backendFilter.type).toBe(PromRuleType.Alerting);
      });

      it('should not include ruleType in backend filter when not provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({}));

        expect(backendFilter.type).toBeUndefined();
      });

      it('should skip ruleType filtering on frontend when backend filtering is enabled', () => {
        const alertingRule = mockGrafanaPromAlertingRule({ name: 'Test Alert' });
        const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Alerting }));
        // Should return true for both because ruleType filter is null (handled by backend)
        expect(frontendFilter.ruleMatches(alertingRule)).toBe(true);
        expect(frontendFilter.ruleMatches(recordingRule)).toBe(true);
      });

      it('should include dashboardUid in backend filter when provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-123' }));

        expect(backendFilter.dashboardUid).toBe('dashboard-123');
      });

      it('should not include dashboardUid in backend filter when not provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({}));

        expect(backendFilter.dashboardUid).toBeUndefined();
      });

      it('should skip dashboardUid filtering on frontend when backend filtering is enabled', () => {
        const ruleWithDashboard = mockGrafanaPromAlertingRule({
          name: 'Dashboard Rule',
          annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
        });

        const { frontendFilter } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-b' }));
        // Should return true because dashboardUid filter is null (handled by backend)
        expect(frontendFilter.ruleMatches(ruleWithDashboard)).toBe(true);
      });

      it('should still apply other frontend filters', () => {
        const rule = mockGrafanaPromAlertingRule({
          name: 'High CPU Usage',
          labels: { severity: 'critical', team: 'ops' },
          alerts: [],
        });

        // Label filter should still work on frontend
        const { frontendFilter } = getGrafanaFilter(getFilter({ labels: ['severity=warning'] }));
        expect(frontendFilter.ruleMatches(rule)).toBe(false);

        const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ labels: ['severity=critical'] }));
        expect(frontendFilter2.ruleMatches(rule)).toBe(true);
      });
    });

    describe('when alertingUIUseBackendFilters is disabled', () => {
      testWithFeatureToggles({ disable: ['alertingUIUseBackendFilters'] });

      it('should not include title in backend filter', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ freeFormWords: ['cpu'] }));

        expect(backendFilter.title).toBeUndefined();
      });

      it('should perform freeFormWords filtering on frontend', () => {
        const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ freeFormWords: ['cpu'] }));
        expect(frontendFilter.ruleMatches(rule)).toBe(true);

        const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ freeFormWords: ['memory'] }));
        expect(frontendFilter2.ruleMatches(rule)).toBe(false);
      });

      it('should perform ruleName filtering on frontend', () => {
        const rule = mockGrafanaPromAlertingRule({ name: 'High CPU Usage' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ ruleName: 'cpu' }));
        expect(frontendFilter.ruleMatches(rule)).toBe(true);

        const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ ruleName: 'memory' }));
        expect(frontendFilter2.ruleMatches(rule)).toBe(false);
      });

      it('should not include ruleType in backend filter', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Alerting }));

        expect(backendFilter.type).toBeUndefined();
      });

      it('should perform ruleType filtering on frontend', () => {
        const alertingRule = mockGrafanaPromAlertingRule({ name: 'Test Alert' });
        const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

        const { frontendFilter } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Alerting }));
        expect(frontendFilter.ruleMatches(alertingRule)).toBe(true);
        expect(frontendFilter.ruleMatches(recordingRule)).toBe(false);

        const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ ruleType: PromRuleType.Recording }));
        expect(frontendFilter2.ruleMatches(alertingRule)).toBe(false);
        expect(frontendFilter2.ruleMatches(recordingRule)).toBe(true);
      });

      it('should not include dashboardUid in backend filter', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-123' }));

        expect(backendFilter.dashboardUid).toBeUndefined();
      });

      it('should perform dashboardUid filtering on frontend', () => {
        const ruleDashboardA = mockGrafanaPromAlertingRule({
          name: 'Dashboard A Rule',
          annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
        });

        const ruleDashboardB = mockGrafanaPromAlertingRule({
          name: 'Dashboard B Rule',
          annotations: { [Annotation.dashboardUID]: 'dashboard-b' },
        });

        const { frontendFilter } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-a' }));
        expect(frontendFilter.ruleMatches(ruleDashboardA)).toBe(true);
        expect(frontendFilter.ruleMatches(ruleDashboardB)).toBe(false);

        const { frontendFilter: frontendFilter2 } = getGrafanaFilter(getFilter({ dashboardUid: 'dashboard-b' }));
        expect(frontendFilter2.ruleMatches(ruleDashboardA)).toBe(false);
        expect(frontendFilter2.ruleMatches(ruleDashboardB)).toBe(true);
      });
    });
  });
});
