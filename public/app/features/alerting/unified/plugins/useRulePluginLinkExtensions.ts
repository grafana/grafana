import { useMemo } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { CombinedRule, Rule, RuleGroupIdentifier } from 'app/types/unified-alerting';
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

export function useRulePluginLinkExtension(rule: Rule, groupIdentifier: RuleGroupIdentifier) {
  const ruleExtensionPoint = useRuleExtensionPoint(rule, groupIdentifier);
  const { links } = usePluginLinks(ruleExtensionPoint);

  const ruleOrigin = getRulePluginOrigin(rule);
  const ruleType = rule.type;
  if (!ruleOrigin || !ruleType) {
    return [];
  }

  const { pluginId } = ruleOrigin;

  return links.filter((link) => link.pluginId === pluginId);
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

function useRuleExtensionPoint(rule: Rule, groupIdentifier: RuleGroupIdentifier): RuleExtensionPoint {
  return useMemo<RuleExtensionPoint>(() => {
    const ruleType = rule.type;

    switch (ruleType) {
      case PromRuleType.Alerting:
        return {
          extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction,
          context: {
            name: rule.name,
            namespace: groupIdentifier.namespaceName,
            group: groupIdentifier.groupName,
            expression: rule.query,
            labels: rule.labels ?? {},
            annotations: rule.annotations ?? {},
          },
        };
      case PromRuleType.Recording:
        return {
          extensionPointId: PluginExtensionPoints.AlertingRecordingRuleAction,
          context: {
            name: rule.name,
            namespace: groupIdentifier.namespaceName,
            group: groupIdentifier.groupName,
            expression: rule.query,
            labels: rule.labels ?? {},
          },
        };
      default:
        return { extensionPointId: '' };
    }
  }, [groupIdentifier, rule]);
}
