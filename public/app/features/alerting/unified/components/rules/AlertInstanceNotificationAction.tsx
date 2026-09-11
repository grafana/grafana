import { skipToken } from '@reduxjs/toolkit/query';
import { chain } from 'lodash';
import { type ReactElement, useMemo, useState } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';
import { type Labels, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { alertInstanceKey, rulerRuleType } from '../../utils/rules';
import { PopupCard } from '../HoverCard';
import { MetaText } from '../MetaText';
import { NAMED_ROOT_LABEL_NAME } from '../notification-policies/useNotificationPolicyRoute';
import { NotificationPolicySidebar } from '../rule-editor/notificaton-preview/NotificationPolicySidebar';
import { useAlertmanagerNotificationRoutingPreview } from '../rule-editor/notificaton-preview/useAlertmanagerNotificationRoutingPreview';
import { ContactPointLink } from '../rule-viewer/ContactPointLink';

/** True when both names refer to the same routing tree, treating every default-tree alias as equal. */
export function routingTreeNamesMatch(a: string | undefined, b: string | undefined): boolean {
  return a === b || (isDefaultRoutingTreeName(a) && isDefaultRoutingTreeName(b));
}

// Returns a copy of `labels` with the routing label either added/updated or removed.
// We use this to make sure the alert instance has the correct current policy before matching,
// since the stored labels may be outdated if the rule's policy was changed since the last evaluation.
function withRoutingPolicyLabel(labels: Labels, policyName: string | undefined): Labels {
  const result = { ...labels };
  if (policyName !== undefined) {
    result[NAMED_ROOT_LABEL_NAME] = policyName;
  } else {
    delete result[NAMED_ROOT_LABEL_NAME];
  }
  return result;
}

// Find a Grafana alerting rule by uid in a list of ruler rules. Uses a `for` loop (not `find`) so
// the type guard narrows the return type.
function findGrafanaAlertingRuleByUid(rules: RulerRuleDTO[] | undefined, uid: string) {
  if (!rules) {
    return undefined;
  }
  for (const rule of rules) {
    if (rulerRuleType.grafana.alertingRule(rule) && rule.grafana_alert.uid === uid) {
      return rule;
    }
  }
  return undefined;
}

interface AlertInstanceNotificationActionProps {
  rule?: CombinedRule;
  instance: Alert;
}

export const AlertInstanceNotificationAction = ({
  rule,
  instance,
}: AlertInstanceNotificationActionProps): ReactElement | null => {
  const [isOpen, setIsOpen] = useState(false);

  const ruleDefinition = rulerRuleType.grafana.alertingRule(rule?.rulerRule) ? rule.rulerRule : undefined;

  // Refresh the rule's ruler data on mount so we always read the latest notification settings,
  // even when the parent's `rule` prop is served from a stale cache. RTK Query dedupes identical
  // args so all rows in the table share one network request.
  const { data: ruleGroup } = alertRuleApi.endpoints.getGrafanaRulerGroup.useQuery(
    ruleDefinition && rule?.namespace.uid && rule?.group.name
      ? { folderUid: rule.namespace.uid, groupName: rule.group.name }
      : skipToken,
    { refetchOnMountOrArgChange: true }
  );

  // Pick the freshest version of the rule available, falling back to the prop while loading.
  const grafanaRule = useMemo(() => {
    if (!ruleDefinition) {
      return undefined;
    }
    return findGrafanaAlertingRuleByUid(ruleGroup?.rules, ruleDefinition.grafana_alert.uid) ?? ruleDefinition;
  }, [ruleDefinition, ruleGroup]);

  const receiver = grafanaRule?.grafana_alert.notification_settings?.receiver;
  // Mirror the form's selectedPolicy initialization: prefer notification_settings.policy, fall
  // back to the __grafana_managed_route__ label for rules saved before alertingPolicyRoutingSettings.
  const routingPolicyName =
    grafanaRule?.grafana_alert.notification_settings?.policy ?? grafanaRule?.labels?.[NAMED_ROOT_LABEL_NAME];

  // The alert instance's stored labels reflect its last evaluation, so __grafana_managed_route__
  // may be stale (or missing) after the rule's tree assignment changes. Override it with the
  // rule's current tree assignment so matching reflects what the alert WILL have post-evaluation.
  const instanceKey = alertInstanceKey(instance);
  const instanceLabels = useMemo(() => {
    if (!grafanaRule || receiver) {
      return [];
    }
    return [withRoutingPolicyLabel(instance.labels, routingPolicyName)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey, routingPolicyName, grafanaRule, receiver]);

  const alertmanager = rule ? getRulesSourceName(rule.namespace.rulesSource) : GRAFANA_RULES_SOURCE_NAME;
  const { treeMatchingResults } = useAlertmanagerNotificationRoutingPreview(
    alertmanager,
    instanceLabels,
    routingPolicyName
  );

  // this is when we have a single receiver all instances are forwarded to – used by simplified routing.
  if (receiver) {
    return (
      <MetaText icon="at">
        <ContactPointLink name={receiver} />
      </MetaText>
    );
  }

  // we might still be loading – show nothing
  if (!grafanaRule) {
    return null;
  }

  const matched = treeMatchingResults[0];

  // Collect all matched routes — a policy with "continue matching" enabled can produce multiple matches per instance.
  const journeys =
    matched?.matchedRoutes.map(({ matchDetails, routeTree }) => ({
      journey: matchDetails.matchingJourney,
      policyName: routeTree?.metadata.name,
    })) ?? [];

  // Guard against stale match results from useAsync's brief transition window: the result's
  // tree name must match the current routing policy. The default tree may be named `user-defined`
  // or `default`, so compare via routingTreeNamesMatch rather than strict equality.
  const expectedTreeName = routingPolicyName ?? ROOT_ROUTE_NAME;
  const isFresh = matched !== undefined && routingTreeNamesMatch(journeys.at(0)?.policyName, expectedTreeName);

  // When all journeys resolve to the same single receiver, surface it next to the button.
  const policyReceivers = isFresh
    ? chain(journeys)
        .map((j) => j.journey.at(-1)?.route.receiver)
        .compact()
        .uniq()
        .value()
    : [];

  const singleResolvedReceiver = policyReceivers.length === 1 ? policyReceivers[0] : undefined;

  return (
    <>
      <Stack direction="column" gap={0.5} alignItems="flex-start">
        {singleResolvedReceiver && <ContactPointLink name={singleResolvedReceiver} />}
        {!singleResolvedReceiver && policyReceivers.length > 1 && (
          <PopupCard
            arrow
            placement="top"
            content={
              <Stack direction="column" gap={0.5}>
                {policyReceivers.map((name) => (
                  <ContactPointLink key={name} name={name} />
                ))}
              </Stack>
            }
          >
            <Button fill="text" variant="primary" size="sm">
              <Trans
                i18nKey="alerting.alert-instance-extension-point.n-contact-points"
                count={policyReceivers.length}
                tOptions={{
                  defaultValue_one: '{{count}} contact point',
                  defaultValue_other: '{{count}} contact points',
                }}
              >
                {'{{count}}'} contact point
              </Trans>
            </Button>
          </PopupCard>
        )}
        <Button
          fill="outline"
          variant="secondary"
          size="sm"
          disabled={!isFresh || journeys.length === 0}
          onClick={() => setIsOpen(true)}
        >
          <Trans
            i18nKey="alerting.alert-instance-extension-point.view-route"
            count={journeys.length}
            tOptions={{
              defaultValue_one: 'View route',
              defaultValue_other: 'View routes',
            }}
          >
            View route
          </Trans>
        </Button>
      </Stack>
      {isOpen && isFresh && journeys.length > 0 && (
        <NotificationPolicySidebar journeys={journeys} labels={matched.labels} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};
