import { config } from '@grafana/runtime';

import {
  mockCombinedCloudRuleNamespace,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaRulerRule,
  mockRuleWithLocation,
  mockRulerAlertingRule,
} from '../mocks';

import { GRAFANA_ORIGIN_LABEL } from './labels';
import {
  getRuleGroupLocationFromCombinedRule,
  getRuleGroupLocationFromRuleWithLocation,
  getRulePluginOrigin,
} from './rules';

describe('getRuleOrigin', () => {
  it('returns undefined when no origin label is present', () => {
    const rule = mockCombinedRule({
      labels: {},
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when origin label does not match expected format', () => {
    const rule = mockCombinedRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'invalid_format' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when plugin is not installed', () => {
    const rule = mockCombinedRule({
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
      },
    };
    const rule = mockCombinedRule({
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
    expect(groupLocation).toEqual({ ruleSourceName: 'grafana', namespace: 'abc123', group: 'group-1' });
  });

  it('should be able to extract rule group location from a data source managed combinedRule', () => {
    const rule = mockCombinedRule({
      group: mockCombinedRuleGroup('group-1', []),
      namespace: mockCombinedCloudRuleNamespace({ name: 'abc123' }, 'prometheus-1'),
      rulerRule: mockRulerAlertingRule(),
    });

    const groupLocation = getRuleGroupLocationFromCombinedRule(rule);
    expect(groupLocation).toEqual({ ruleSourceName: 'prometheus-1', namespace: 'abc123', group: 'group-1' });
  });

  it('should be able to extract rule group location from a Grafana managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockGrafanaRulerRule({ namespace_uid: 'abc123' }));
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual({ ruleSourceName: 'grafana', namespace: 'abc123', group: 'group-1' });
  });

  it('should be able to extract rule group location from a data source managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockRulerAlertingRule({}), { namespace: 'abc123' });
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual({ ruleSourceName: 'grafana', namespace: 'abc123', group: 'group-1' });
  });
});
