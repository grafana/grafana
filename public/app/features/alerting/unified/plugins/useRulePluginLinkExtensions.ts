import { useMemo } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginLinkExtensions } from '@grafana/runtime';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { getRulePluginOrigin } from '../utils/rules';

interface BaseRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
}

export interface AlertingRuleExtensionContext extends BaseRuleExtensionContext {
  annotations: Record<string, string>;
}

export interface RecordingRuleExtensionContext extends BaseRuleExtensionContext {}

export function useRulePluginLinkExtension(rule: CombinedRule) {
  const ruleExtensionPoint = useRuleExtensionPoint(rule);
  const { extensions } = usePluginLinkExtensions(ruleExtensionPoint);

  const ruleOrigin = getRulePluginOrigin(rule);
  const ruleType = rule.promRule?.type;
  if (!ruleOrigin || !ruleType) {
    return [];
  }

  const { pluginId } = ruleOrigin;

  return extensions.filter((extension) => extension.pluginId === pluginId);
}

export interface PluginRuleExtensionParam {
  pluginId: string;
  rule: CombinedRule;
}

interface AlertingRuleExtensionPoint {
  extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction;
  context: AlertingRuleExtensionContext;
}

interface RecordingRuleExtensionPoint {
  extensionPointId: PluginExtensionPoints.AlertingRecordingRuleAction;
  context: RecordingRuleExtensionContext;
}

interface EmptyExtensionPoint {
  extensionPointId: '';
}

type RuleExtensionPoint = AlertingRuleExtensionPoint | RecordingRuleExtensionPoint | EmptyExtensionPoint;

function useRuleExtensionPoint(rule: CombinedRule): RuleExtensionPoint {
  return useMemo(() => {
    const ruleType = rule.promRule?.type;

    switch (ruleType) {
      case PromRuleType.Alerting:
        return {
          extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction,
          context: {
            name: rule.name,
            namespace: rule.namespace.name,
            group: rule.group.name,
            expression: rule.query,
            labels: rule.labels,
            annotations: rule.annotations,
          },
        };
      case PromRuleType.Recording:
        return {
          extensionPointId: PluginExtensionPoints.AlertingRecordingRuleAction,
          context: {
            name: rule.name,
            namespace: rule.namespace.name,
            group: rule.group.name,
            expression: rule.query,
            labels: rule.labels,
          },
        };
      default:
        return { extensionPointId: '' };
    }
  }, [rule]);
}
