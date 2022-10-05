import { GrafanaConfig, PluginMeta, usePluginContext } from '@grafana/data';

import { config } from '../../config';
import { reportInteraction } from '../utils';

import { PluginEventProperties } from './types';

export function usePluginInteractionReporter() {
  const { meta } = usePluginContext();

  return (interactionName: string, properties?: Record<string, string | number | boolean>) => {
    const info = createPluginInfo(meta, config);
    return reportInteraction(interactionName, { ...properties, ...info });
  };
}

function createPluginInfo(meta: PluginMeta, config: GrafanaConfig): PluginEventProperties {
  return {
    grafana_version: config.buildInfo.version,
    plugin_type: meta.type,
    plugin_version: meta.info.version,
    plugin_id: meta.id,
    plugin_name: meta.name,
  };
}
