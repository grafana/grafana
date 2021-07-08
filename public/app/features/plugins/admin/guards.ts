import { LocalPlugin } from './types';

export function isLocalPlugin(plugin: any): plugin is LocalPlugin {
  // super naive way of figuring out if this is a local plugin
  return 'category' in plugin;
}
