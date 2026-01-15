import { PluginExtensionAddedFunctionConfig } from '@grafana/data';
import { getCreateAlertFromPanelExtensionConfig } from 'app/features/alerting/unified/extensions/createAlertFromPanel';

export function getCoreFunctionConfigurations(): PluginExtensionAddedFunctionConfig[] {
  return [getCreateAlertFromPanelExtensionConfig()];
}
