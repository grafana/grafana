import { type ReactElement, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { rulerRuleType } from '../../utils/rules';
import { NotificationPolicySidebar } from '../rule-editor/notificaton-preview/NotificationPolicySidebar';
import { ContactPointLink } from '../rule-viewer/ContactPointLink';
import { useAlertmanagerNotificationRoutingPreview } from '../rule-editor/notificaton-preview/useAlertmanagerNotificationRoutingPreview';

interface AlertInstanceExtensionPointProps {
  rule?: CombinedRule;
  instance: Alert;
  showRouting?: boolean;
}

export const AlertInstanceExtensionPoint = ({
  rule,
  instance,
  showRouting,
}: AlertInstanceExtensionPointProps): ReactElement | null => {
  const [isPreviewRoutingOpen, setIsPreviewRoutingOpen] = useState(false);

  const rulerRule = rule?.rulerRule;
  const alertmanager = rule ? getRulesSourceName(rule.namespace.rulesSource) : GRAFANA_RULES_SOURCE_NAME;
  const isGrafanaManagedUsingNotificationPolicies =
    showRouting &&
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

  if (!showRouting) {
    return null;
  }

  if (isGrafanaManagedUsingNotificationPolicies) {
    const previewRoutingInstance = treeMatchingResults[0];
    const previewRoutingJourney = previewRoutingInstance?.matchedRoutes[0]?.matchDetails?.matchingJourney;

    return (
      <>
        <Button fill="outline" variant="secondary" size="sm" onClick={() => setIsPreviewRoutingOpen(true)}>
          <Trans i18nKey="alerting.alert-instance-extension-point.view-route">View route</Trans>
        </Button>
        {isPreviewRoutingOpen && previewRoutingInstance && previewRoutingJourney && (
          <NotificationPolicySidebar
            policyName={policyName}
            journey={previewRoutingJourney}
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
