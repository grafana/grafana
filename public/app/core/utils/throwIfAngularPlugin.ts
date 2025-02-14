import { PluginMeta } from '@grafana/data';

export function throwIfAngularPlugin(meta: PluginMeta): void {
  const isAngular = meta.angular?.detected ?? meta.angularDetected;
  if (isAngular) {
    throw new Error('Angular plugins are not supported');
  }
}
