import { type ReactElement, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { rulerRuleType } from '../../utils/rules';
import { NotificationPolicySidebar } from '../rule-editor/notificaton-preview/NotificationPolicySidebar';
import { ContactPointLink } from '../rule-viewer/ContactPointLink';
import { useAlertmanagerNotificationRoutingPreview } from '../rule-editor/notificaton-preview/useAlertmanagerNotificationRoutingPreview';

interface AlertInstanceNotificationActionProps {
  rule?: CombinedRule;
  instance: Alert;
}

export const AlertInstanceNotificationAction = ({
  rule,
  instance,
}: AlertInstanceNotificationActionProps): ReactElement | null => {
  const [isPreviewRoutingOpen, setIsPreviewRoutingOpen] = useState(false);

  const rulerRule = rule?.rulerRule;
  const alertmanager = rule ? getRulesSourceName(rule.namespace.rulesSource) : GRAFANA_RULES_SOURCE_NAME;
  // A rule uses notification policies when no direct receiver is configured; otherwise it uses simplified routing.
  const isGrafanaManagedUsingNotificationPolicies =
    rulerRuleType.grafana.alertingRule(rulerRule) &&
    !rulerRule.grafana_alert.notification_settings?.receiver;

  const policyName = isGrafanaManagedUsingNotificationPolicies
    ? rulerRule.grafana_alert.notification_settings?.policy
    : undefined;

  const { treeMatchingResults } = useAlertmanagerNotificationRoutingPreview(
    alertmanager,
    isGrafanaManagedUsingNotificationPolicies ? [instance.labels] : [],
    policyName
  );

  if (isGrafanaManagedUsingNotificationPolicies) {
    const previewRoutingInstance = treeMatchingResults[0];
    // Collect all matched routes — a policy with "continue matching" enabled can produce multiple matches per instance.
    const journeys =
      previewRoutingInstance?.matchedRoutes.map(({ matchDetails }) => ({
        journey: matchDetails.matchingJourney,
        policyName,
      })) ?? [];

    return (
      <>
        <Button fill="outline" variant="secondary" size="sm" onClick={() => setIsPreviewRoutingOpen(true)}>
          <Trans i18nKey="alerting.alert-instance-extension-point.view-route">View route</Trans>
        </Button>
        {isPreviewRoutingOpen && previewRoutingInstance && journeys.length > 0 && (
          <NotificationPolicySidebar
            journeys={journeys}
            labels={previewRoutingInstance.labels}
            onClose={() => setIsPreviewRoutingOpen(false)}
          />
        )}
      </>
    );
  }

  const receiverName = rulerRuleType.grafana.alertingRule(rulerRule)
    ? rulerRule.grafana_alert.notification_settings?.receiver
    : undefined;

  if (receiverName) {
    return <ContactPointLink name={receiverName} />;
  }

  return null;
};
