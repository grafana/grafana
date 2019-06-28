import { Task, TaskRunner } from './task';
import { bundlePlugin, PluginBundleOptions } from './plugin/bundle';

const pluginDevRunner: TaskRunner<PluginBundleOptions> = async options => {
  const result = await bundlePlugin(options);
  return result;
};

export const pluginDevTask = new Task<PluginBundleOptions>('Dev plugin', pluginDevRunner);
