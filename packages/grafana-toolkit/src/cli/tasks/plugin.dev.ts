import { Task, TaskRunner } from './task';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { useSpinner } from '../utils/useSpinner';

const bundlePlugin = useSpinner<PluginBundleOptions>('Bundling plugin in dev mode', options => {
  return bundleFn(options);
});

const pluginDevRunner: TaskRunner<PluginBundleOptions> = async options => {
  if (options.watch) {
    await bundleFn(options);
  } else {
    const result = await bundlePlugin(options);
    return result;
  }
};

export const pluginDevTask = new Task<PluginBundleOptions>('Dev plugin', pluginDevRunner);
