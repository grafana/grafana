import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import {
  mockCombinedCloudRuleNamespace,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
  mockRuleWithLocation,
  mockRulerAlertingRule,
} from '../mocks';

import { GRAFANA_ORIGIN_LABEL } from './labels';
import {
  NO_GROUP_PREFIX,
  getRuleGroupLocationFromCombinedRule,
  getRuleGroupLocationFromRuleWithLocation,
  getRulePluginOrigin,
  isUngroupedRuleGroup,
} from './rules';

describe('getRuleOrigin', () => {
  it('returns undefined when no origin label is present', () => {
    const rule = mockPromAlertingRule({
      labels: {},
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when origin label does not match expected format', () => {
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'invalid_format' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when plugin is not installed', () => {
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/uninstalled_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns pluginId when origin label matches expected format and plugin is installed', () => {
    config.apps = {
      installed_plugin: {
        id: 'installed_plugin',
        version: '',
        path: '',
        preload: true,
        angular: { detected: false, hideDeprecation: false },
        loadingStrategy: PluginLoadingStrategy.script,
        extensions: {
          addedLinks: [],
          addedComponents: [],
          extensionPoints: [],
          exposedComponents: [],
          addedFunctions: [],
        },
        dependencies: {
          grafanaVersion: '',
          plugins: [],
          extensions: {
            exposedComponents: [],
          },
        },
      },
    };
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/installed_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toEqual({ pluginId: 'installed_plugin' });
  });
});

describe('ruleGroupLocation', () => {
  it('should be able to extract rule group location from a Grafana managed combinedRule', () => {
    const rule = mockCombinedRule({
      group: mockCombinedRuleGroup('group-1', []),
      rulerRule: mockGrafanaRulerRule({ namespace_uid: 'abc123' }),
    });

    const groupLocation = getRuleGroupLocationFromCombinedRule(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a data source managed combinedRule', () => {
    const rule = mockCombinedRule({
      group: mockCombinedRuleGroup('group-1', []),
      namespace: mockCombinedCloudRuleNamespace({ name: 'abc123' }, 'prometheus-1'),
      rulerRule: mockRulerAlertingRule(),
    });

    const groupLocation = getRuleGroupLocationFromCombinedRule(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'prometheus-1',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a Grafana managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockGrafanaRulerRule({ namespace_uid: 'abc123' }));
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a data source managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockRulerAlertingRule({}), { namespace: 'abc123' });
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });
});

describe('isUngroupedRuleGroup', () => {
  it('should return true for group names starting with NO_GROUP_PREFIX', () => {
    expect(isUngroupedRuleGroup('no_group_for_rule_abc123')).toBe(true);
    expect(isUngroupedRuleGroup('no_group_for_rule_')).toBe(true);
    expect(isUngroupedRuleGroup('no_group_for_rule_test-rule-uid')).toBe(true);
  });

  it('should return false for group names not starting with NO_GROUP_PREFIX', () => {
    expect(isUngroupedRuleGroup('MyGroup')).toBe(false);
    expect(isUngroupedRuleGroup('group-1')).toBe(false);
    expect(isUngroupedRuleGroup('')).toBe(false);
  });

  it('should return false for group names that contain but do not start with NO_GROUP_PREFIX', () => {
    expect(isUngroupedRuleGroup('prefix_no_group_for_rule_abc123')).toBe(false);
    expect(isUngroupedRuleGroup('MyGroup_no_group_for_rule_')).toBe(false);
  });
});
