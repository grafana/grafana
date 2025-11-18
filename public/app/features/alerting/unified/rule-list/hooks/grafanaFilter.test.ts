import { testWithFeatureToggles } from 'test/test-utils';

import { PromAlertingRuleState, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { getFilter } from '../../utils/search';

import { getGrafanaFilter, hasClientSideFilters } from './grafanaFilter';

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

      it('should include searchGroupName in backend filter when provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ groupName: 'my-group' }));

        expect(backendFilter.searchGroupName).toBe('my-group');
      });

      it('should not include searchGroupName in backend filter when not provided', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({}));

        expect(backendFilter.searchGroupName).toBeUndefined();
      });

      it('should skip groupName filtering on frontend when backend filtering is enabled', () => {
        const group: PromRuleGroupDTO = {
          name: 'CPU Usage Alerts',
          file: 'production/alerts',
          rules: [],
          interval: 60,
        };

        const { frontendFilter } = getGrafanaFilter(getFilter({ groupName: 'memory' }));
        // Should return true because groupName filter is null (handled by backend)
        expect(frontendFilter.groupMatches(group)).toBe(true);
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

      it('should not include searchGroupName in backend filter', () => {
        const { backendFilter } = getGrafanaFilter(getFilter({ groupName: 'my-group' }));

        expect(backendFilter.searchGroupName).toBeUndefined();
      });

      it('should perform groupName filtering on frontend', () => {
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
    });
  });

  describe('hasClientSideFilters', () => {
    describe('when alertingUIUseBackendFilters is disabled', () => {
      testWithFeatureToggles({ disable: ['alertingUIUseBackendFilters'] });

      it('should return false when no filters are applied', () => {
        expect(hasClientSideFilters(getFilter({}))).toBe(false);
      });

      it('should return true for title-related filters (freeFormWords, ruleName)', () => {
        expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
        expect(hasClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(true);
      });

      it('should return true for ruleType filter', () => {
        expect(hasClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      });

      it('should return true for dashboardUid filter', () => {
        expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      });

      it('should return true for groupName filter', () => {
        expect(hasClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(true);
      });

      it('should return true for client-side only filters', () => {
        expect(hasClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
        expect(hasClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      });

      it('should return false for backend-only filters (state, health, contactPoint)', () => {
        expect(hasClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);
      });
    });

    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should return false when no filters are applied', () => {
        expect(hasClientSideFilters(getFilter({}))).toBe(false);
      });

      it('should return false for title-related filters (handled by backend)', () => {
        expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
        expect(hasClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(false);
      });

      it('should return false for ruleType filter (handled by backend)', () => {
        expect(hasClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
      });

      it('should return false for dashboardUid filter (handled by backend)', () => {
        expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(false);
      });

      it('should return false for groupName filter (handled by backend)', () => {
        expect(hasClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(false);
      });

      it('should return true for client-side only filters', () => {
        expect(hasClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
        expect(hasClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      });

      it('should return false for backend-only filters (state, health, contactPoint)', () => {
        expect(hasClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);
      });
    });
  });
});
