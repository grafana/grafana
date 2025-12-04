import { testWithFeatureToggles } from 'test/test-utils';

import { PromAlertingRuleState, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { getFilter } from '../../utils/search';

import { getGrafanaFilter, hasGrafanaClientSideFilters } from './grafanaFilter';

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

    it('should not set hasInvalidDataSourceNames flag when no data source names are provided', () => {
      const { hasInvalidDataSourceNames } = getGrafanaFilter(getFilter({}));

      expect(hasInvalidDataSourceNames).toBe(false);
    });
  });

  describe('backend filtering with alertingUIUseBackendFilters feature toggle', () => {
    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should include datasources in backend filter when valid data source names are provided', () => {
        const { backendFilter, hasInvalidDataSourceNames } = getGrafanaFilter(
          getFilter({ dataSourceNames: ['prometheus', 'loki'] })
        );

        expect(backendFilter.datasources).toEqual(['datasource-uid-1', 'datasource-uid-3']);
        expect(hasInvalidDataSourceNames).toBe(false);
      });

      it('should detect invalid data source names and set hasInvalidDataSourceNames flag', () => {
        const { backendFilter, hasInvalidDataSourceNames } = getGrafanaFilter(
          getFilter({ dataSourceNames: ['non-existent-datasource'] })
        );

        expect(backendFilter.datasources).toEqual([]);
        expect(hasInvalidDataSourceNames).toBe(true);
      });

      it('should include only valid datasource UIDs when some names are invalid', () => {
        const { backendFilter, hasInvalidDataSourceNames } = getGrafanaFilter(
          getFilter({ dataSourceNames: ['prometheus', 'non-existent-datasource'] })
        );

        expect(backendFilter.datasources).toEqual(['datasource-uid-1']);
        expect(hasInvalidDataSourceNames).toBe(false); // Not all are invalid
      });

      it('should skip dataSourceNames filtering on frontend when backend filtering is enabled', () => {
        const rule = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });

        const { frontendFilter } = getGrafanaFilter(getFilter({ dataSourceNames: ['loki'] }));
        // Should return true because dataSourceNames filter is null (handled by backend).
        expect(frontendFilter.ruleMatches(rule)).toBe(true);
      });

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

    describe('when alertingUIUseFullyCompatBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseFullyCompatBackendFilters'] });

      it('should populate backend filters correctly (ruleType, dashboardUid)', () => {
        // Fully compatible filters should be in backend
        const { backendFilter } = getGrafanaFilter(
          getFilter({
            ruleType: PromRuleType.Alerting,
            dashboardUid: 'dashboard-123',
            freeFormWords: ['cpu'],
            groupName: 'my-group',
          })
        );

        expect(backendFilter.type).toBe(PromRuleType.Alerting);
        expect(backendFilter.dashboardUid).toBe('dashboard-123');

        // Non-compatible filters should NOT be in backend
        expect(backendFilter.title).toBeUndefined();
        expect(backendFilter.searchGroupName).toBeUndefined();

        // Empty state
        const { backendFilter: emptyFilter } = getGrafanaFilter(getFilter({}));
        expect(emptyFilter.type).toBeUndefined();
        expect(emptyFilter.dashboardUid).toBeUndefined();
      });

      it('should apply frontend filters correctly', () => {
        const alertingRule = mockGrafanaPromAlertingRule({
          name: 'High CPU Usage',
          labels: { severity: 'critical' },
          queriedDatasourceUIDs: ['datasource-uid-1'],
          annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
          alerts: [],
        });
        const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

        // Backend-handled filters (ruleType, dashboardUid) should skip frontend filtering
        const { frontendFilter: backendHandledFilter } = getGrafanaFilter(
          getFilter({ ruleType: PromRuleType.Recording, dashboardUid: 'dashboard-b' })
        );
        expect(backendHandledFilter.ruleMatches(alertingRule)).toBe(true);
        expect(backendHandledFilter.ruleMatches(recordingRule)).toBe(true);

        // Frontend-handled filters (freeFormWords, ruleName) should work
        const { frontendFilter: freeFormMatch } = getGrafanaFilter(getFilter({ freeFormWords: ['cpu'] }));
        expect(freeFormMatch.ruleMatches(alertingRule)).toBe(true);

        const { frontendFilter: freeFormNoMatch } = getGrafanaFilter(getFilter({ freeFormWords: ['memory'] }));
        expect(freeFormNoMatch.ruleMatches(alertingRule)).toBe(false);

        const { frontendFilter: ruleNameMatch } = getGrafanaFilter(getFilter({ ruleName: 'cpu' }));
        expect(ruleNameMatch.ruleMatches(alertingRule)).toBe(true);

        const { frontendFilter: ruleNameNoMatch } = getGrafanaFilter(getFilter({ ruleName: 'memory' }));
        expect(ruleNameNoMatch.ruleMatches(alertingRule)).toBe(false);

        // Group name filtering
        const group: PromRuleGroupDTO = {
          name: 'CPU Usage Alerts',
          file: 'production/alerts',
          rules: [],
          interval: 60,
        };

        const { frontendFilter: groupMatch } = getGrafanaFilter(getFilter({ groupName: 'cpu' }));
        expect(groupMatch.groupMatches(group)).toBe(true);

        const { frontendFilter: groupNoMatch } = getGrafanaFilter(getFilter({ groupName: 'memory' }));
        expect(groupNoMatch.groupMatches(group)).toBe(false);

        // Always-frontend filters (labels, namespace) should work.
        const { frontendFilter: labelsMatch } = getGrafanaFilter(getFilter({ labels: ['severity=critical'] }));
        expect(labelsMatch.ruleMatches(alertingRule)).toBe(true);

        const { frontendFilter: labelsNoMatch } = getGrafanaFilter(getFilter({ labels: ['severity=warning'] }));
        expect(labelsNoMatch.ruleMatches(alertingRule)).toBe(false);

        const { frontendFilter: nsMatch } = getGrafanaFilter(getFilter({ namespace: 'production' }));
        expect(nsMatch.groupMatches(group)).toBe(true);

        const { frontendFilter: nsNoMatch } = getGrafanaFilter(getFilter({ namespace: 'staging' }));
        expect(nsNoMatch.groupMatches(group)).toBe(false);
      });

      it('should skip dataSourceNames filtering on frontend (handled by backend)', () => {
        const alertingRule = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });

        // DataSourceNames is backend-filtered when feature toggle is enabled.
        const { frontendFilter: dsMatch } = getGrafanaFilter(getFilter({ dataSourceNames: ['prometheus'] }));
        expect(dsMatch.ruleMatches(alertingRule)).toBe(true);

        const { frontendFilter: dsNoMatch } = getGrafanaFilter(getFilter({ dataSourceNames: ['loki'] }));
        expect(dsNoMatch.ruleMatches(alertingRule)).toBe(true);
      });
    });

    describe('when both alertingUIUseBackendFilters and alertingUIUseFullyCompatBackendFilters are enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should include all backend filters (title, ruleType, dashboardUid, searchGroupName)', () => {
        const { backendFilter } = getGrafanaFilter(
          getFilter({
            freeFormWords: ['cpu'],
            ruleName: 'alert',
            ruleType: PromRuleType.Alerting,
            dashboardUid: 'dashboard-123',
            groupName: 'my-group',
          })
        );

        expect(backendFilter.title).toBe('alert cpu');
        expect(backendFilter.type).toBe(PromRuleType.Alerting);
        expect(backendFilter.dashboardUid).toBe('dashboard-123');
        expect(backendFilter.searchGroupName).toBe('my-group');
      });

      it('should skip all backend-handled filters on frontend', () => {
        const alertingRule = mockGrafanaPromAlertingRule({
          name: 'High CPU Usage',
          annotations: { [Annotation.dashboardUID]: 'dashboard-a' },
        });
        const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

        const { frontendFilter } = getGrafanaFilter(
          getFilter({
            freeFormWords: ['memory'],
            ruleName: 'memory',
            ruleType: PromRuleType.Recording,
            dashboardUid: 'dashboard-b',
          })
        );

        // All these filters are handled by backend, so frontend should return true
        expect(frontendFilter.ruleMatches(alertingRule)).toBe(true);
        expect(frontendFilter.ruleMatches(recordingRule)).toBe(true);
      });

      it('should skip groupName filtering on frontend', () => {
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

      it('should still apply always-frontend filters (labels, namespace)', () => {
        const rule = mockGrafanaPromAlertingRule({
          name: 'High CPU Usage',
          labels: { severity: 'critical' },
          alerts: [],
        });

        // Labels filter should still work
        const { frontendFilter: labelFilter } = getGrafanaFilter(getFilter({ labels: ['severity=warning'] }));
        expect(labelFilter.ruleMatches(rule)).toBe(false);

        const { frontendFilter: labelFilter2 } = getGrafanaFilter(getFilter({ labels: ['severity=critical'] }));
        expect(labelFilter2.ruleMatches(rule)).toBe(true);

        // Namespace filter should still work
        const group: PromRuleGroupDTO = {
          name: 'Test Group',
          file: 'production/alerts',
          rules: [],
          interval: 60,
        };

        const { frontendFilter: nsFilter } = getGrafanaFilter(getFilter({ namespace: 'production' }));
        expect(nsFilter.groupMatches(group)).toBe(true);

        const { frontendFilter: nsFilter2 } = getGrafanaFilter(getFilter({ namespace: 'staging' }));
        expect(nsFilter2.groupMatches(group)).toBe(false);
      });

      it('should skip dataSourceNames filtering on frontend (handled by backend)', () => {
        const rule = mockGrafanaPromAlertingRule({
          queriedDatasourceUIDs: ['datasource-uid-1'],
        });

        // DataSourceNames is backend-filtered when both feature toggles are enabled.
        const { frontendFilter: dsFilter } = getGrafanaFilter(getFilter({ dataSourceNames: ['prometheus'] }));
        expect(dsFilter.ruleMatches(rule)).toBe(true);

        const { frontendFilter: dsFilter2 } = getGrafanaFilter(getFilter({ dataSourceNames: ['loki'] }));
        expect(dsFilter2.ruleMatches(rule)).toBe(true);
      });
    });
  });

  describe('hasGrafanaClientSideFilters', () => {
    describe('when alertingUIUseBackendFilters is disabled', () => {
      testWithFeatureToggles({ disable: ['alertingUIUseBackendFilters'] });

      it('should return false when no filters are applied', () => {
        expect(hasGrafanaClientSideFilters(getFilter({}))).toBe(false);
      });

      it('should return true for title-related filters (freeFormWords, ruleName)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(true);
      });

      it('should return true for ruleType filter', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      });

      it('should return true for dashboardUid filter', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      });

      it('should return true for groupName filter', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(true);
      });

      it('should return true for client-side only filters', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      });

      it('should return false for backend-only filters (state, health, contactPoint)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);
      });
    });

    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should return false when no filters are applied', () => {
        expect(hasGrafanaClientSideFilters(getFilter({}))).toBe(false);
      });

      it('should return false for title-related filters (handled by backend)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(false);
      });

      it('should return false for ruleType filter (handled by backend)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
      });

      it('should return false for dashboardUid filter (handled by backend)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(false);
      });

      it('should return false for groupName filter (handled by backend)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(false);
      });

      it('should return false for dataSourceNames (handled by backend when feature toggle is enabled)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(false);
      });

      it('should return true for client-side only filters', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      });

      it('should return false for backend-only filters (state, health, contactPoint)', () => {
        expect(hasGrafanaClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);
      });
    });

    describe('when alertingUIUseFullyCompatBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseFullyCompatBackendFilters'] });

      it('should return correct values for all filter types', () => {
        // Should return false for: empty, backend-handled (ruleType, dashboardUid, dataSourceNames), and backend-only filters
        expect(hasGrafanaClientSideFilters(getFilter({}))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);

        // Should return true for: frontend-handled filters
        expect(hasGrafanaClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      });
    });

    describe('when both alertingUIUseBackendFilters and alertingUIUseFullyCompatBackendFilters are enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should return correct values for all filter types', () => {
        // Should return false for: empty, all backend-handled filters, and backend-only filters
        expect(hasGrafanaClientSideFilters(getFilter({}))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleName: 'alert' }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ groupName: 'test-group' }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
        expect(hasGrafanaClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);

        // Should return true for: always-frontend filters only (namespace, labels)
        expect(hasGrafanaClientSideFilters(getFilter({ namespace: 'production' }))).toBe(true);
        expect(hasGrafanaClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);

        // Should return false for: backend-handled dataSourceNames when feature toggles are enabled
        expect(hasGrafanaClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(false);
      });
    });
  });
});
