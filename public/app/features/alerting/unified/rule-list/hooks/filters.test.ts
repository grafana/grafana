import { PromAlertingRuleState, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
import * as datasourceUtils from '../../utils/datasource';
import { getFilter } from '../../utils/search';

import { groupFilter, ruleFilter } from './filters';

describe('groupFilter', () => {
  it('should filter by namespace (file path)', () => {
    const group: PromRuleGroupDTO = {
      name: 'Test Group',
      file: 'production/alerts',
      rules: [],
      interval: 60,
    };

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

    expect(groupFilter(group, getFilter({}))).toBe(true);
  });
});

describe('ruleFilter', () => {
  it('should filter by free form words in rule name', () => {
    const rule = mockPromAlertingRule({ name: 'High CPU Usage' });

    expect(ruleFilter(rule, getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
    expect(ruleFilter(rule, getFilter({ freeFormWords: ['memory'] }))).toBe(false);
  });

  it('should filter by rule name', () => {
    const rule = mockPromAlertingRule({ name: 'High CPU Usage' });

    expect(ruleFilter(rule, getFilter({ ruleName: 'cpu' }))).toBe(true);
    expect(ruleFilter(rule, getFilter({ ruleName: 'memory' }))).toBe(false);
  });

  it('should filter by labels', () => {
    const rule = mockPromAlertingRule({
      labels: { severity: 'critical', team: 'ops' },
      alerts: [],
    });

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

    expect(ruleFilter(rule, getFilter({ labels: ['instance=server-1'] }))).toBe(true);
    expect(ruleFilter(rule, getFilter({ labels: ['env=production'] }))).toBe(true);
    expect(ruleFilter(rule, getFilter({ labels: ['instance=server-2'] }))).toBe(false);
  });

  it('should filter by rule type', () => {
    const alertingRule = mockPromAlertingRule({ name: 'Test Alert' });
    const recordingRule = mockPromRecordingRule({ name: 'Test Recording' });

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

    expect(ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Firing }))).toBe(true);
    expect(ruleFilter(firingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(false);
    expect(ruleFilter(pendingRule, getFilter({ ruleState: PromAlertingRuleState.Pending }))).toBe(true);
  });

  it('should filter out recording rules when filtering by rule state', () => {
    const recordingRule = mockPromRecordingRule({
      name: 'Recording Rule',
    });

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

    expect(ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Ok }))).toBe(true);
    expect(ruleFilter(healthyRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(false);
    expect(ruleFilter(errorRule, getFilter({ ruleHealth: RuleHealth.Error }))).toBe(true);
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

    expect(ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-a' }))).toBe(true);
    expect(ruleFilter(ruleDashboardA, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(false);
    expect(ruleFilter(ruleDashboardB, getFilter({ dashboardUid: 'dashboard-b' }))).toBe(true);
  });

  it('should filter out recording rules when filtering by dashboard UID', () => {
    const recordingRule = mockPromRecordingRule({
      name: 'Recording Rule',
      // Recording rules cannot have dashboard UIDs because they don't have annotations
    });

    // Dashboard UID filter should filter out recording rules
    expect(ruleFilter(recordingRule, getFilter({ dashboardUid: 'any-dashboard' }))).toBe(false);
  });

  describe('dataSourceNames filter', () => {
    let getDataSourceUIDSpy: jest.SpyInstance;

    beforeEach(() => {
      getDataSourceUIDSpy = jest.spyOn(datasourceUtils, 'getDatasourceAPIUid').mockImplementation((ruleSourceName) => {
        if (ruleSourceName === 'prometheus') {
          return 'datasource-uid-1';
        }
        if (ruleSourceName === 'loki') {
          return 'datasource-uid-3';
        }
        throw new Error(`Unknown datasource name: ${ruleSourceName}`);
      });
    });

    afterEach(() => {
      // Clean up
      getDataSourceUIDSpy.mockRestore();
    });

    it('should match rules that use the filtered datasource', () => {
      // Create a Grafana rule with matching datasource
      const ruleWithMatchingDatasource = mockGrafanaPromAlertingRule({
        queriedDatasourceUIDs: ['datasource-uid-1'],
      });

      // 'prometheus' resolves to 'datasource-uid-1' which is in the rule
      expect(ruleFilter(ruleWithMatchingDatasource, getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
    });

    it('should not filter Grafana rules by dataSourceNames (handled via gmaQueryDataSourceNames)', () => {
      // Create a Grafana rule without the target datasource
      const ruleWithoutMatchingDatasource = mockGrafanaPromAlertingRule({
        queriedDatasourceUIDs: ['datasource-uid-1', 'datasource-uid-2'],
      });

      // 'loki' resolves to 'datasource-uid-3' which is not in the rule
      // dataSourceNames no longer applies to Grafana rules; expect pass-through
      expect(ruleFilter(ruleWithoutMatchingDatasource, getFilter({ dataSourceNames: ['loki'] }))).toBe(true);
    });

    it('should ignore invalid Grafana rule queries for dataSourceNames (filter not applied)', () => {
      const ruleWithInvalidQuery = mockGrafanaPromAlertingRule({
        query: 'not-valid-json',
      });

      expect(ruleFilter(ruleWithInvalidQuery, getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
    });
  });

  describe('gmaQueryDataSourceNames filter (Grafana-managed rules)', () => {
    let getDataSourceUIDSpy: jest.SpyInstance;

    beforeEach(() => {
      getDataSourceUIDSpy = jest.spyOn(datasourceUtils, 'getDatasourceAPIUid').mockImplementation((ruleSourceName) => {
        if (ruleSourceName === 'prometheus') {
          return 'datasource-uid-1';
        }
        if (ruleSourceName === 'loki') {
          return 'datasource-uid-3';
        }
        throw new Error(`Unknown datasource name: ${ruleSourceName}`);
      });
    });

    afterEach(() => {
      getDataSourceUIDSpy.mockRestore();
    });

    it('should match Grafana rules that use the filtered query datasource', () => {
      const grafanaRule = mockGrafanaPromAlertingRule({ queriedDatasourceUIDs: ['datasource-uid-1'] });
      expect(ruleFilter(grafanaRule, getFilter({ gmaQueryDataSourceNames: ['prometheus'] }))).toBe(true);
    });

    it('should filter out Grafana rules that do not use the filtered query datasource', () => {
      const grafanaRule = mockGrafanaPromAlertingRule({ queriedDatasourceUIDs: ['datasource-uid-1'] });
      expect(ruleFilter(grafanaRule, getFilter({ gmaQueryDataSourceNames: ['loki'] }))).toBe(false);
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

    expect(ruleFilter(rule, filter)).toBe(false);
  });
});
