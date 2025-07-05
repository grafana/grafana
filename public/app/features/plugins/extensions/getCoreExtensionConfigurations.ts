import { PluginExtensionAddedLinkConfig } from '@grafana/data';
import { getAlertingExtensionConfigs } from 'app/features/alerting/unified/components/rule-editor/alert-rule-form/extensions/getAlertingExtensionConfigs';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginExtensionAddedLinkConfig[] {
  return [...getExploreExtensionConfigs(), ...getAlertingExtensionConfigs()];
}
