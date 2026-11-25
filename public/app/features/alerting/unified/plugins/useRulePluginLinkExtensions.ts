import { useMemo } from 'react';

import { type PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { type Rule, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { getRulePluginOrigin } from '../utils/rules';

interface BaseRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
}

interface AlertingRuleExtensionContext extends BaseRuleExtensionContext {
  annotations: Record<string, string>;
}

interface RecordingRuleExtensionContext extends BaseRuleExtensionContext {}

// Stable empty array so consumers don't re-render when the rule has no extensions.
const EMPTY_LINKS: PluginExtensionLink[] = [];

export function useRulePluginLinkExtension(rule: Rule | undefined, groupIdentifier: RuleGroupIdentifierV2) {
  const ruleExtensionPoint = useRuleExtensionPoint(rule, groupIdentifier);
  const { links } = usePluginLinks(ruleExtensionPoint);

  if (!rule) {
    return EMPTY_LINKS;
  }

  const ruleOrigin = getRulePluginOrigin(rule);
  const ruleType = rule.type;
  if (!ruleOrigin || !ruleType) {
    return EMPTY_LINKS;
  }

  const { pluginId } = ruleOrigin;

  return links.filter((link) => link.pluginId === pluginId);
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

function useRuleExtensionPoint(rule: Rule | undefined, groupIdentifier: RuleGroupIdentifierV2): RuleExtensionPoint {
  return useMemo<RuleExtensionPoint>(() => {
    if (!rule) {
      return { extensionPointId: '' };
    }

    const ruleType = rule.type;
    const { namespace, groupName } = groupIdentifier;
    const namespaceIdentifier = 'uid' in namespace ? namespace.uid : namespace.name;

    switch (ruleType) {
      case PromRuleType.Alerting:
        return {
          extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction,
          context: {
            name: rule.name,
            namespace: namespaceIdentifier,
            group: groupName,
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
            namespace: namespaceIdentifier,
            group: groupName,
            expression: rule.query,
            labels: rule.labels ?? {},
          },
        };
      default:
        return { extensionPointId: '' };
    }
  }, [groupIdentifier, rule]);
}
