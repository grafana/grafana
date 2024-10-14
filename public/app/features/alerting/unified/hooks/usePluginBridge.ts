import { useAsync } from 'react-use';

import { PluginMeta } from '@grafana/data';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { PluginID } from '../components/PluginBridge';
// LOGZ.IO CHANGE :: DEV-46522 disable the oncall grafana plugin
import { SupportedPlugin } from '../types/pluginBridges';
interface PluginBridgeHookResponse {
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}

export function usePluginBridge(plugin: PluginID): PluginBridgeHookResponse {
  const { loading, error, value } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));
  // LOGZ.IO CHANGE :: DEV-46522 disable the oncall grafana plugin
  if (plugin === SupportedPlugin.OnCall) {
    return { loading: false, installed: false};
  }
  // LOGZ.IO CHANGE :: DEV-46522 disable the oncall grafana plugin. END
  const installed = value && !error && !loading;
  const enabled = value?.enabled;
  const isLoading = loading && !value;

  if (isLoading) {
    return { loading: true };
  }

  if (!installed || !enabled) {
    return { loading: false, installed: false };
  }

  return { loading, installed: true, settings: value };
}
