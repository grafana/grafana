import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useRef } from 'react';

import { PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { CombinedRule, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleCompact, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { getRulePluginOrigin, prometheusRuleType, rulerRuleType } from '../utils/rules';

const { useGetAlertRuleQuery } = alertRuleApi;

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

const emptyExtensionPoint: RuleExtensionPoint = { extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction };

export function useRulePluginLinkExtension(
  rule: PromRuleCompact | undefined,
  groupIdentifier: RuleGroupIdentifierV2
): PluginExtensionLink[] {
  // This ref provides a stable reference to an empty array, which is used to avoid re-renders when the rule is undefined.
  const emptyResponse = useRef<PluginExtensionLink[]>([]);

  // Type guard: If it's a Grafana rule, it's GrafanaPromRuleCompact (always has uid)
  const isGrafanaRule = prometheusRuleType.grafana.rule(rule);

  // Fetch full rule data for Grafana rules to get the query
  const { data: rulerRule, isLoading } = useGetAlertRuleQuery(isGrafanaRule && rule ? { uid: rule.uid } : skipToken);

  const ruleExtensionPoint = useMemo<RuleExtensionPoint>(() => {
    if (!rule) {
      return emptyExtensionPoint;
    }

    if (isGrafanaRule) {
      // For Grafana rules, wait for ruler data
      if (!rulerRule) {
        return emptyExtensionPoint;
      }
      return buildGrafanaRuleExtensionPoint(rulerRule, groupIdentifier);
    } else if (hasQueryProperty(rule)) {
      // For non-Grafana rules with query property
      return buildPromRuleExtensionPoint(rule, groupIdentifier);
    }

    return emptyExtensionPoint;
  }, [rule, groupIdentifier, isGrafanaRule, rulerRule]);

  const { links } = usePluginLinks(ruleExtensionPoint);

  if (!rule) {
    return emptyResponse.current;
  }

  // Return empty array while loading for Grafana rules to prevent flickering
  if (isLoading && isGrafanaRule) {
    return emptyResponse.current;
  }

  const ruleOrigin = getRulePluginOrigin(rule);
  const ruleType = rule.type;
  if (!ruleOrigin || !ruleType) {
    return emptyResponse.current;
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
  extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction;
}

type RuleExtensionPoint = AlertingRuleExtensionPoint | RecordingRuleExtensionPoint | EmptyExtensionPoint;

/**
 * Type guard to check if a rule has a query property.
 * This is used to determine if we can build an extension point without fetching additional data.
 * Note: This will match any rule with a query property, including GrafanaPromRuleDTO with query present.
 */
function hasQueryProperty(rule: PromRuleCompact): rule is PromRuleCompact & { query: string } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return 'query' in rule && typeof (rule as { query?: unknown }).query === 'string';
}

function buildPromRuleExtensionPoint(
  rule: PromRuleCompact & { query: string },
  groupIdentifier: RuleGroupIdentifierV2
): RuleExtensionPoint {
  const { namespace, groupName } = groupIdentifier;
  const namespaceIdentifier = 'uid' in namespace ? namespace.uid : namespace.name;

  switch (rule.type) {
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
      return emptyExtensionPoint;
  }
}

function buildGrafanaRuleExtensionPoint(
  rulerRule: RulerGrafanaRuleDTO,
  groupIdentifier: RuleGroupIdentifierV2
): RuleExtensionPoint {
  const { namespace, groupName } = groupIdentifier;
  const namespaceIdentifier = 'uid' in namespace ? namespace.uid : namespace.name;

  // Extract query from ruler rule
  const query = JSON.stringify(rulerRule.grafana_alert?.data);

  if (rulerRuleType.grafana.recordingRule(rulerRule)) {
    return {
      extensionPointId: PluginExtensionPoints.AlertingRecordingRuleAction,
      context: {
        name: rulerRule.grafana_alert.title,
        namespace: namespaceIdentifier,
        group: groupName,
        expression: query,
        labels: rulerRule.labels ?? {},
      },
    };
  } else if (rulerRuleType.grafana.alertingRule(rulerRule)) {
    return {
      extensionPointId: PluginExtensionPoints.AlertingAlertingRuleAction,
      context: {
        name: rulerRule.grafana_alert.title,
        namespace: namespaceIdentifier,
        group: groupName,
        expression: query,
        labels: rulerRule.labels ?? {},
        annotations: rulerRule.annotations ?? {},
      },
    };
  } else {
    return emptyExtensionPoint;
  }
}
