import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

export interface RuleListItemIndicatorProps {
  rule: GrafanaPromRuleDTO;
}

/**
 * Renders components extending the annotations section of the alert rule editor.
 * Extensions are rendered inside the rule form provider and can use the form context.
 */
export function AnnotationsAssistantExtensionPoint() {
  const { components } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.AlertingRuleAnnotationsAssistant,
    limitPerPlugin: 1,
  });

  return (
    <>
      {components.map((Component) => (
        <Component key={Component.meta.id} />
      ))}
    </>
  );
}

/**
 * Renders components previewing the notification message in the alert rule editor.
 * Extensions are rendered inside the rule form provider and can use the form context.
 */
export function NotificationPreviewExtensionPoint() {
  const { components } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.AlertingRuleNotificationPreview,
    limitPerPlugin: 1,
  });

  return (
    <>
      {components.map((Component) => (
        <Component key={Component.meta.id} />
      ))}
    </>
  );
}

/**
 * Renders per-rule indicator components (e.g. badges or icons) next to the actions
 * of a Grafana-managed alert rule list item.
 */
export function RuleListItemIndicatorExtensionPoint({ rule }: RuleListItemIndicatorProps) {
  const { components } = usePluginComponents<RuleListItemIndicatorProps>({
    extensionPointId: PluginExtensionPoints.AlertingRuleListItemIndicator,
    limitPerPlugin: 1,
  });

  return (
    <>
      {components.map((Component) => (
        <Component key={Component.meta.id} rule={rule} />
      ))}
    </>
  );
}
