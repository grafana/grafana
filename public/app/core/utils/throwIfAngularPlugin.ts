import { PanelPlugin, PluginMeta } from '@grafana/data';

export function throwIfAngularPlugin(meta?: PanelPlugin): void;
export function throwIfAngularPlugin(meta?: PluginMeta): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throwIfAngularPlugin(meta?: any): void {
  const isAngular = meta?.angular?.detected ?? meta?.angularDetected ?? meta?.angularPanelCtrl ?? false;
  if (isAngular) {
    throw new Error('Angular plugins are not supported');
  }
}
