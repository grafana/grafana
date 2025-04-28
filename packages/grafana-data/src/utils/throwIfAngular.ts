import { PanelPlugin } from '../panel/PanelPlugin';
import { PluginMeta } from '../types/plugin';

export function throwIfAngular(module?: System.Module): void;
export function throwIfAngular(panel?: PanelPlugin): void;
export function throwIfAngular(plugin?: PluginMeta): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throwIfAngular(data?: any): void {
  const isAngularPlugin = data?.angular?.detected ?? data?.angularDetected ?? false;
  const isAngularPanel = data?.angularPanelCtrl ?? false;
  const isAngularModule = data.PanelCtrl ?? data?.ConfigCtrl ?? false;
  if (isAngularPlugin || isAngularPanel || isAngularModule) {
    throw new Error('Angular plugins are not supported');
  }
}
