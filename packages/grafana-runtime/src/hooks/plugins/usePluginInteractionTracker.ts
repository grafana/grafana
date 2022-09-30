import { useMemo } from 'react';
import { reportInteraction } from 'src/utils/analytics';

import { GrafanaConfig, PluginMeta, usePluginContext } from '@grafana/data';

export function usePluginInteractionTracker() {
  // I would like to use the `useGrafana`to fetch the config instead of passing it via the plugin context.
  const { config, meta } = usePluginContext();

  return useMemo(() => {
    return (interactionName: string, properties?: Record<string, string | number | boolean>) => {
      const info = createPluginInfo(meta, config);
      return reportInteraction(interactionName, { ...properties, ...info });
    };
  }, [config, meta]);
}

function createPluginInfo(meta: PluginMeta, config: GrafanaConfig): Record<string, string | number | boolean> {
  return {
    grafana_version: config.buildInfo.version,
    plugin_type: meta.type,
    plugin_version: meta.info.version,
    plugin_id: meta.id,
    plugin_name: meta.name,
  };
}
