import { PromAlertingRuleState, PromRuleDTO, PromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { mockPromAlertingRule, mockPromRecordingRule } from '../../mocks';
import { RuleHealth } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';
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
      health: 'OK',
    });

    const errorRule = mockPromAlertingRule({
      name: 'Error Rule',
      health: 'Error',
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

  // For plugins filter test we'll need to rely on actual implementation of isPluginProvidedRule
  // We're just testing if the filter logic works correctly, not the plugin detection itself

  it('should combine multiple filters with AND logic', () => {
    const rule = mockPromAlertingRule({
      name: 'High CPU Usage Production',
      labels: { severity: 'critical', environment: 'production' },
      state: PromAlertingRuleState.Firing,
    });

    // All filters match
    expect(
      ruleFilter(
        rule,
        getFilter({
          ruleName: 'cpu',
          labels: ['severity=critical', 'environment=production'],
          ruleState: PromAlertingRuleState.Firing,
          ruleHealth: RuleHealth.Ok,
        })
      )
    ).toBe(true);

    // One filter doesn't match
    expect(
      ruleFilter(
        rule,
        getFilter({
          ruleName: 'cpu',
          labels: ['severity=warning'], // This doesn't match
          ruleState: PromAlertingRuleState.Firing,
          ruleHealth: RuleHealth.Ok,
        })
      )
    ).toBe(false);
  });
});
