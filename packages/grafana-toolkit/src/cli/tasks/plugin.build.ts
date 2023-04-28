import { useSpinner } from '../utils/useSpinner';

import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { Task, TaskRunner } from './task';

interface PluginBuildOptions {
  coverage: boolean;
  maxJestWorkers?: string;
  preserveConsole?: boolean;
  skipTest?: boolean;
  skipLint?: boolean;
}

const bundlePlugin = (options: PluginBundleOptions) => useSpinner('Compiling...', () => bundleFn(options));

export const pluginBuildRunner: TaskRunner<PluginBuildOptions> = async ({ preserveConsole }) => {
  await bundlePlugin({ watch: false, production: true, preserveConsole });
};

export const pluginBuildTask = new Task<PluginBuildOptions>('Build plugin', pluginBuildRunner);
