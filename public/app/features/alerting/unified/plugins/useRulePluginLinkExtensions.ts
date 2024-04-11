import { PluginExtensionPoints } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { getRuleOrigin } from '../utils/rules';

interface AlertingRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface RecordingRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
}

export function useRulePluginLinkExtension(rule: CombinedRule) {
  const ruleOrigin = getRuleOrigin(rule);
  const ruleType = rule.promRule?.type;
  if (!ruleOrigin || !ruleType) {
    return [];
  }

  const { pluginId } = ruleOrigin;

  switch (ruleType) {
    case PromRuleType.Alerting:
      return getAlertingRuleActionPluginLinkExtension({ pluginId, rule });
    case PromRuleType.Recording:
      return getRecordingRulePluginLinkExtension({ pluginId, rule });
    default:
      return [];
  }
}

function getAlertingRuleActionPluginLinkExtension({ pluginId, rule }: { pluginId: string; rule: CombinedRule }) {
  const context: AlertingRuleExtensionContext = {
    name: rule.name,
    namespace: rule.namespace.name,
    group: rule.group.name,
    expression: rule.query,
    labels: rule.labels,
    annotations: rule.annotations,
  };

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.AlertingRuleAction,
    context,
    limitPerPlugin: 3,
  });

  return extensions.filter((extension) => extension.pluginId === pluginId);
}

function getRecordingRulePluginLinkExtension({ pluginId, rule }: { pluginId: string; rule: CombinedRule }) {
  const context: RecordingRuleExtensionContext = {
    name: rule.name,
    namespace: rule.namespace.name,
    group: rule.group.name,
    expression: rule.query,
    labels: rule.labels,
  };

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.RecordingRuleAction,
    context,
    limitPerPlugin: 3,
  });

  return extensions.filter((extension) => extension.pluginId === pluginId);
}
