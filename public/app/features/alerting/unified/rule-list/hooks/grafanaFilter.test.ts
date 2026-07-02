import { USER_DEFINED_TREE_NAME } from '@grafana/alerting';
import { setAppPluginMetas } from '@grafana/runtime/internal';
import {
  type GrafanaNotificationSettings,
  PromAlertingRuleState,
  type PromRuleGroupDTO,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { pluginMeta, pluginMetaToPluginConfig } from '../../testSetup/plugins';
import { SupportedPlugin } from '../../types/pluginBridges';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { ruleUsesDefaultPolicy } from '../../utils/rules';
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
  describe('ruleFilter - policy filter (frontend-only)', () => {
    it('should filter by policy routing', () => {
      const ruleWithPolicy = mockGrafanaPromAlertingRule({
        name: 'Rule with Policy',
        notificationSettings: { policy: 'team-a-policy' },
      });
      const ruleWithDifferentPolicy = mockGrafanaPromAlertingRule({
        name: 'Rule with Different Policy',
        notificationSettings: { policy: 'team-b-policy' },
      });
      const ruleWithContactPoint = mockGrafanaPromAlertingRule({
        name: 'Rule with Contact Point',
        notificationSettings: { receiver: 'slack' },
      });

      const { frontendFilter } = getGrafanaFilter(getFilter({ policy: 'team-a-policy' }));
      expect(frontendFilter.ruleMatches(ruleWithPolicy)).toBe(true);
      expect(frontendFilter.ruleMatches(ruleWithDifferentPolicy)).toBe(false);
      expect(frontendFilter.ruleMatches(ruleWithContactPoint)).toBe(false);
    });

    it('should match rules using the default policy when filtering by user-defined', () => {
      const ruleWithNoSettings = mockGrafanaPromAlertingRule({
        name: 'Rule with no notification settings',
      });
      const ruleWithContactPoint = mockGrafanaPromAlertingRule({
        name: 'Rule with Contact Point',
        notificationSettings: { receiver: 'slack' },
      });
      const ruleWithExplicitPolicy = mockGrafanaPromAlertingRule({
        name: 'Rule with Explicit Policy',
        notificationSettings: { policy: 'team-a-policy' },
      });
      const ruleWithExplicitUserDefinedPolicy = mockGrafanaPromAlertingRule({
        name: 'Rule explicitly set to user-defined policy',
        notificationSettings: { policy: USER_DEFINED_TREE_NAME },
      });

      const { frontendFilter } = getGrafanaFilter(getFilter({ policy: USER_DEFINED_TREE_NAME }));
      expect(frontendFilter.ruleMatches(ruleWithNoSettings)).toBe(true);
      expect(frontendFilter.ruleMatches(ruleWithExplicitUserDefinedPolicy)).toBe(true);
      expect(frontendFilter.ruleMatches(ruleWithContactPoint)).toBe(false);
      expect(frontendFilter.ruleMatches(ruleWithExplicitPolicy)).toBe(false);
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

  describe('backend filtering', () => {
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

    it('should include ruleMatchers in backend filter when labels are provided', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({ labels: ['severity=critical'] }));

      expect(backendFilter.ruleMatchers).toBeDefined();
      expect(backendFilter.ruleMatchers).toHaveLength(1);
      expect(backendFilter.ruleMatchers).toEqual([
        '{"name":"severity","value":"critical","isRegex":false,"isEqual":true}',
      ]);
    });

    it('should include plugins in backend filter and skip frontend filtering', () => {
      // Set up test plugin as installed
      setAppPluginMetas({ [SupportedPlugin.Slo]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Slo]) });

      const regularRule = mockGrafanaPromAlertingRule({
        name: 'High CPU Usage',
        labels: { severity: 'critical', team: 'ops' },
        alerts: [],
      });

      const pluginRule = mockGrafanaPromAlertingRule({
        name: 'Plugin Rule',
        labels: { __grafana_origin: `plugin/${SupportedPlugin.Slo}` },
        alerts: [],
      });

      // Plugins filter should be handled by backend
      const { backendFilter, frontendFilter } = getGrafanaFilter(getFilter({ plugins: 'hide' }));

      // Backend filter should include plugins parameter
      expect(backendFilter.plugins).toBe('hide');

      // Frontend filter should pass through all rules (no filtering)
      expect(frontendFilter.ruleMatches(regularRule)).toBe(true);
      expect(frontendFilter.ruleMatches(pluginRule)).toBe(true);
    });

    it('should include searchFolder in backend filter when namespace is provided', () => {
      const { backendFilter } = getGrafanaFilter(getFilter({ namespace: 'my-folder' }));

      expect(backendFilter.searchFolder).toBe('my-folder');
    });

    it('should skip namespace filtering on frontend when backend filtering is enabled', () => {
      const group: PromRuleGroupDTO = {
        name: 'Test Group',
        file: 'production/alerts',
        rules: [],
        interval: 60,
      };

      const { frontendFilter } = getGrafanaFilter(getFilter({ namespace: 'staging' }));
      // Should return true because namespace filter is null (handled by backend)
      expect(frontendFilter.groupMatches(group)).toBe(true);
    });
  });

  describe('hasGrafanaClientSideFilters', () => {
    it('returns false when no policy filter is set', () => {
      expect(hasGrafanaClientSideFilters(getFilter({}))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ ruleName: 'foo' }))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(false);
      expect(hasGrafanaClientSideFilters(getFilter({ contactPoint: 'my-contact-point' }))).toBe(false);
    });

    it('returns true when a policy filter is set', () => {
      expect(hasGrafanaClientSideFilters(getFilter({ policy: 'my-policy' }))).toBe(true);
    });
  });
});

describe('ruleUsesDefaultPolicy', () => {
  it('should return true when notificationSettings is undefined', () => {
    expect(ruleUsesDefaultPolicy(undefined)).toBe(true);
  });

  it('should return true when notificationSettings has no receiver and no policy', () => {
    expect(ruleUsesDefaultPolicy({} as GrafanaNotificationSettings)).toBe(true);
  });

  it('should return true when policy is explicitly set to USER_DEFINED_TREE_NAME', () => {
    expect(ruleUsesDefaultPolicy({ policy: USER_DEFINED_TREE_NAME })).toBe(true);
  });

  it('should return false when a receiver is set', () => {
    expect(ruleUsesDefaultPolicy({ receiver: 'slack' })).toBe(false);
  });

  it('should return false when a non-default policy is set', () => {
    expect(ruleUsesDefaultPolicy({ policy: 'team-a-policy' })).toBe(false);
  });
});
