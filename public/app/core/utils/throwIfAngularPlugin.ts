import { PanelPlugin, PluginMeta } from '@grafana/data';

export function throwIfAngularPlugin(module?: System.Module): void;
export function throwIfAngularPlugin(panel?: PanelPlugin): void;
export function throwIfAngularPlugin(plugin?: PluginMeta): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throwIfAngularPlugin(data?: any): void {
  const isAngular =
    data?.angular?.detected ?? data?.angularDetected ?? data?.angularPanelCtrl ?? data.PanelCtrl ?? false;
  if (isAngular) {
    throw new Error('Angular plugins are not supported');
  }
}
