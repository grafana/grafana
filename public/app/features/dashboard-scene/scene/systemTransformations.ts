import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

export function pluginTransformationsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false);
}
