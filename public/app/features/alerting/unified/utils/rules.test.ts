import { PluginLoadingStrategy } from '@grafana/data';
import { setAppPluginMetas } from '@grafana/runtime/internal';
import { type RuleGroupIdentifier } from 'app/types/unified-alerting';

import {
  mockCombinedCloudRuleNamespace,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaPromAlertingRule,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
  mockRuleWithLocation,
  mockRulerAlertingRule,
} from '../mocks';

import { GRAFANA_ORIGIN_LABEL } from './labels';
import {
  getPromGroupReadOnlyStatus,
  getRuleGroupLocationFromCombinedRule,
  getRuleGroupLocationFromRuleWithLocation,
  getRulePluginOrigin,
  getRulerGroupReadOnlyStatus,
  isUngroupedRuleGroup,
} from './rules';

describe('getRuleOrigin', () => {
  afterEach(() => {
    setAppPluginMetas({});
  });

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

  it('returns pluginId even when plugin is not installed', () => {
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/uninstalled_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toEqual({ pluginId: 'uninstalled_plugin' });
  });

  it('returns pluginId when origin label matches expected format and plugin is installed', () => {
    setAppPluginMetas({
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
    });
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

describe('getRulerGroupReadOnlyStatus', () => {
  it('reports readOnly=false for an editable Ruler group', () => {
    const group = {
      rules: [mockRulerAlertingRule()],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: false });
  });

  it('reports reason=plugin when any rule carries the plugin origin label', () => {
    const group = {
      rules: [mockRulerAlertingRule({ labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/grafana-test-app' } })],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'plugin' });
  });

  it('reports reason=provisioned for a Grafana-managed rule with provenance', () => {
    const group = {
      rules: [
        { ...mockGrafanaRulerRule(), grafana_alert: { ...mockGrafanaRulerRule().grafana_alert, provenance: 'api' } },
      ],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'provisioned' });
  });

  it('reports reason=federated when the group has source_tenants', () => {
    const group = {
      rules: [mockRulerAlertingRule()],
      source_tenants: ['tenant-1'],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'federated' });
  });

  it('prefers plugin over provisioned when both apply', () => {
    const group = {
      rules: [
        { ...mockGrafanaRulerRule(), grafana_alert: { ...mockGrafanaRulerRule().grafana_alert, provenance: 'api' } },
        mockRulerAlertingRule({ labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/grafana-test-app' } }),
      ],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'plugin' });
  });

  it('prefers provisioned over federated when both apply', () => {
    const group = {
      rules: [
        { ...mockGrafanaRulerRule(), grafana_alert: { ...mockGrafanaRulerRule().grafana_alert, provenance: 'api' } },
      ],
      source_tenants: ['tenant-1'],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'provisioned' });
  });

  it('prefers plugin over federated when both apply', () => {
    const group = {
      rules: [mockRulerAlertingRule({ labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/grafana-test-app' } })],
      source_tenants: ['tenant-1'],
    };
    expect(getRulerGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'plugin' });
  });

  it('reports readOnly=false for a group with no rules', () => {
    expect(getRulerGroupReadOnlyStatus({ rules: [] })).toEqual({ readOnly: false });
  });
});

describe('getPromGroupReadOnlyStatus', () => {
  it('reports readOnly=false for an editable Prom group', () => {
    const group = { rules: [mockPromAlertingRule()] };
    expect(getPromGroupReadOnlyStatus(group)).toEqual({ readOnly: false });
  });

  it('reports reason=plugin when any rule carries the plugin origin label', () => {
    const group = {
      rules: [mockPromAlertingRule({ labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/grafana-test-app' } })],
    };
    expect(getPromGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'plugin' });
  });

  it('reports reason=provisioned for a Grafana-managed Prom rule with provenance', () => {
    const group = { rules: [mockGrafanaPromAlertingRule({ provenance: 'api' })] };
    expect(getPromGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'provisioned' });
  });

  it('prefers plugin over provisioned when both apply', () => {
    const group = {
      rules: [
        mockGrafanaPromAlertingRule({ provenance: 'api' }),
        mockPromAlertingRule({ labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/grafana-test-app' } }),
      ],
    };
    expect(getPromGroupReadOnlyStatus(group)).toEqual({ readOnly: true, reason: 'plugin' });
  });

  it('reports readOnly=false for a group with no rules', () => {
    expect(getPromGroupReadOnlyStatus({ rules: [] })).toEqual({ readOnly: false });
  });
});
