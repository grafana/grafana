import { config } from '@grafana/runtime';

import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';

import { mockRulerAlertingRule, mockRulerGrafanaRule, mockRulerRuleGroup } from '../mocks';
import { pluginMeta, pluginMetaToPluginConfig } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';
import { Annotation } from '../utils/constants';
import { GRAFANA_ORIGIN_LABEL } from '../utils/labels';

import { cloneRuleDefinition } from './clone.utils';

describe('cloneRuleDefinition', () => {
  it("Should change the cloned rule's name accordingly for Grafana rules", () => {
    const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
      {
        for: '1m',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      },
      { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
    );

    const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    const grafanaRule: RulerGrafanaRuleDTO = clonedRule.rule as RulerGrafanaRuleDTO;

    expect(originalRule.rule.grafana_alert.title).toEqual('First Grafana Rule');
    expect(grafanaRule.grafana_alert.title).toEqual('First Grafana Rule (copy)');
  });

  it("Should change the cloned rule's name accordingly for Ruler rules", () => {
    const rule: RulerAlertingRuleDTO = mockRulerAlertingRule({
      for: '1m',
      alert: 'First Ruler Rule',
      expr: 'vector(1) > 0',
      labels: { severity: 'critical', region: 'nasa' },
      annotations: { [Annotation.summary]: 'This is a very important alert rule' },
    });

    const originalRule: RuleWithLocation<RulerAlertingRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    const alertingRule: RulerAlertingRuleDTO = clonedRule.rule as RulerAlertingRuleDTO;

    expect(originalRule.rule.alert).toEqual('First Ruler Rule');
    expect(alertingRule.alert).toEqual('First Ruler Rule (copy)');
  });

  it("Should change the cloned rule's name accordingly for Recording rules", () => {
    const rule: RulerRecordingRuleDTO = {
      record: 'instance:node_num_cpu:sum',
      expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
      labels: { type: 'cpu' },
    };

    const originalRule: RuleWithLocation<RulerRecordingRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    const recordingRule: RulerRecordingRuleDTO = clonedRule.rule as RulerRecordingRuleDTO;

    expect(originalRule.rule.record).toEqual('instance:node_num_cpu:sum');
    expect(recordingRule.record).toEqual('instance:node_num_cpu:sum (copy)');
  });

  it('Should remove the group for provisioned Grafana rules', () => {
    const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
      {
        for: '1m',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      },
      { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [], provenance: 'foo' }
    );

    const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    expect(originalRule.group.name).toEqual('group1');
    expect(clonedRule.group.name).toEqual('');
  });

  it('The cloned rule should not contain a UID property', () => {
    const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
      {
        for: '1m',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      },
      { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
    );

    const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    const grafanaRule: RulerGrafanaRuleDTO = clonedRule.rule as RulerGrafanaRuleDTO;

    expect(originalRule.rule.grafana_alert.uid).toEqual('grafana-rule-1');
    expect(grafanaRule.grafana_alert.uid).toEqual('');
  });

  it('Should remove the origin label when cloning data source plugin-provided rules', () => {
    // Mock the plugin as installed
    config.apps = {
      [SupportedPlugin.Slo]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Slo]),
    };

    const rule: RulerAlertingRuleDTO = mockRulerAlertingRule({
      alert: 'slo-provider-alert',
      expr: 'vector(1) > 0',
      for: '1m',
      labels: {
        severity: 'critical',
        region: 'nasa',
        [GRAFANA_ORIGIN_LABEL]: 'plugin/' + SupportedPlugin.Slo,
      },
      annotations: { [Annotation.summary]: 'This is a plugin-provided alert rule' },
    });

    const originalRule: RuleWithLocation<RulerAlertingRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const { rule: clonedRule } = cloneRuleDefinition(originalRule);

    // Original rule should have the origin label
    expect(originalRule.rule.labels?.[GRAFANA_ORIGIN_LABEL]).toEqual('plugin/' + SupportedPlugin.Slo);

    // Cloned rule should not have the origin label
    expect(clonedRule.labels?.[GRAFANA_ORIGIN_LABEL]).toBeUndefined();

    // Other labels should be preserved
    expect(clonedRule.labels?.severity).toEqual('critical');
    expect(clonedRule.labels?.region).toEqual('nasa');
  });

  it('Should remove the origin label when cloning Grafana-managed plugin-provided rules', () => {
    config.apps = {
      [SupportedPlugin.Slo]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Slo]),
    };

    const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
      {
        for: '1m',
        labels: {
          severity: 'critical',
          [GRAFANA_ORIGIN_LABEL]: 'plugin/' + SupportedPlugin.Slo,
        },
        annotations: { [Annotation.summary]: 'Plugin-provided Grafana rule' },
      },
      { uid: 'grafana-plugin-rule', title: 'Plugin Grafana Rule', data: [] }
    );

    const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
      ruleSourceName: 'grafana',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const { rule: clonedRule } = cloneRuleDefinition(originalRule);

    expect(originalRule.rule.labels?.[GRAFANA_ORIGIN_LABEL]).toEqual('plugin/' + SupportedPlugin.Slo);
    expect(clonedRule.labels?.[GRAFANA_ORIGIN_LABEL]).toBeUndefined();
    expect(clonedRule.labels?.severity).toEqual('critical');
  });

  it('Should remove the origin label when cloning data source recording rules', () => {
    const rule: RulerRecordingRuleDTO = {
      record: 'plugin:recording:rule',
      expr: 'sum(metric)',
      labels: {
        type: 'cpu',
        [GRAFANA_ORIGIN_LABEL]: 'plugin/' + SupportedPlugin.Slo,
      },
    };

    const originalRule: RuleWithLocation<RulerRecordingRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const { rule: clonedRule } = cloneRuleDefinition(originalRule);

    expect(originalRule.rule.labels?.[GRAFANA_ORIGIN_LABEL]).toBeDefined();
    expect(clonedRule.labels?.[GRAFANA_ORIGIN_LABEL]).toBeUndefined();
    expect(clonedRule.labels?.type).toEqual('cpu');
  });

  it('Should preserve all labels when cloning non-plugin-provided rules', () => {
    const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
      {
        for: '1m',
        labels: {
          severity: 'critical',
          region: 'nasa',
          custom_label: 'custom_value',
        },
        annotations: { [Annotation.summary]: 'This is a regular alert rule' },
      },
      { uid: 'regular-rule-1', title: 'Regular Alert Rule', data: [] }
    );

    const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
      ruleSourceName: 'my-prom-ds',
      namespace: 'namespace-one',
      group: mockRulerRuleGroup(),
      rule,
    };

    const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

    const grafanaRule: RulerGrafanaRuleDTO = clonedRule.rule as RulerGrafanaRuleDTO;

    // All labels should be preserved for non-plugin rules
    expect(grafanaRule.labels?.severity).toEqual('critical');
    expect(grafanaRule.labels?.region).toEqual('nasa');
    expect(grafanaRule.labels?.custom_label).toEqual('custom_value');
  });
});
