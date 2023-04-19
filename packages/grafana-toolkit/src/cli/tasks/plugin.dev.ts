import { useSpinner } from '../utils/useSpinner';

import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { lintPlugin } from './plugin.build';
import { Task, TaskRunner } from './task';

const bundlePlugin = (options: PluginBundleOptions) =>
  useSpinner('Bundling plugin in dev mode', () => bundleFn(options));

const pluginDevRunner: TaskRunner<PluginBundleOptions> = async (options) => {
  if (options.watch) {
    await bundleFn(options);
  } else {
    // Always fix lint in dev mode
    await lintPlugin({ fix: true });

    const result = await bundlePlugin(options);
    return result;
  }
};

export const pluginDevTask = new Task<PluginBundleOptions>('Dev plugin', pluginDevRunner);
