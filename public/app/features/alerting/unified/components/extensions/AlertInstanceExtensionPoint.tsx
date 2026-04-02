import { type ReactElement, useMemo, useState } from 'react';

import { type PluginExtensionLink, type PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { ConfirmNavigationModal } from 'app/features/explore/extensions/ConfirmNavigationModal';
// We might want to customise this in future but right now the toolbar menu from the Explore view is fine.
import { ToolbarExtensionPointMenu as AlertExtensionPointMenu } from 'app/features/explore/extensions/ToolbarExtensionPointMenu';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { rulerRuleType } from '../../utils/rules';
import { NotificationPolicySidebar } from '../rule-editor/notificaton-preview/NotificationPolicySidebar';
import { useAlertmanagerNotificationRoutingPreview } from '../rule-editor/notificaton-preview/useAlertmanagerNotificationRoutingPreview';

interface AlertInstanceExtensionPointProps {
  rule?: CombinedRule;
  instance: Alert;
  extensionPointId: PluginExtensionPoints;
  showPreviewRouting?: boolean;
}

const PREVIEW_ROUTING_EXTENSION_BASE = {
  type: PluginExtensionTypes.link,
  id: 'preview-routing',
  pluginId: 'grafana',
  description: '',
  icon: 'sitemap',
} satisfies Omit<PluginExtensionLink, 'title' | 'onClick'>;

export const AlertInstanceExtensionPoint = ({
  rule,
  instance,
  extensionPointId,
  showPreviewRouting,
}: AlertInstanceExtensionPointProps): ReactElement | null => {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const [isPreviewRoutingOpen, setIsPreviewRoutingOpen] = useState(false);

  const context = useMemo(() => ({ instance, rule }), [instance, rule]);
  const { links } = usePluginLinks({ context, extensionPointId, limitPerPlugin: 3 });

  const rulerRule = rule?.rulerRule;
  const alertmanager = rule ? getRulesSourceName(rule.namespace.rulesSource) : GRAFANA_RULES_SOURCE_NAME;
  const policyName =
    showPreviewRouting && rulerRuleType.grafana.alertingRule(rulerRule)
      ? rulerRule.grafana_alert.notification_settings?.policy
      : undefined;

  const { treeMatchingResults } = useAlertmanagerNotificationRoutingPreview(
    alertmanager,
    showPreviewRouting ? [instance.labels] : [],
    policyName
  );

  const previewRoutingExtension: PluginExtensionLink = useMemo(
    () => ({
      ...PREVIEW_ROUTING_EXTENSION_BASE,
      title: t('alerting.alert-instance-extension-point.preview-routing', 'Preview routing'),
      onClick: () => setIsPreviewRoutingOpen(true),
    }),
    []
  );

  const allLinks = useMemo(
    () => (showPreviewRouting ? [...links, previewRoutingExtension] : links),
    [links, showPreviewRouting, previewRoutingExtension]
  );

  if (allLinks.length === 0) {
    return null;
  }

  const previewRoutingInstance = treeMatchingResults[0];
  const previewRoutingJourney = previewRoutingInstance?.matchedRoutes[0]?.matchDetails?.matchingJourney;

  const menu = <AlertExtensionPointMenu extensions={allLinks} onSelect={setSelectedExtension} />;
  return (
    <>
      <Dropdown placement="bottom-start" overlay={menu}>
        <IconButton
          name="ellipsis-v"
          aria-label={t('alerting.alert-instance-extension-point.aria-label-actions', 'Actions')}
          variant="secondary"
        />
      </Dropdown>
      {!!selectedExtension && !!selectedExtension.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
      {isPreviewRoutingOpen && showPreviewRouting && previewRoutingInstance && previewRoutingJourney && (
        <NotificationPolicySidebar
          policyName={policyName}
          journey={previewRoutingJourney}
          labels={previewRoutingInstance.labels}
          onClose={() => setIsPreviewRoutingOpen(false)}
        />
      )}
    </>
  );
};

export type PluginExtensionAlertInstanceContext = {
  rule?: CombinedRule;
  instance: Alert;
};
