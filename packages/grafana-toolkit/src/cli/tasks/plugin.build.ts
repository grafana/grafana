import execa from 'execa';
import { resolve as resolvePath } from 'path';

import { useSpinner } from '../utils/useSpinner';

import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { testPlugin } from './plugin/tests';
import { Task, TaskRunner } from './task';

interface PluginBuildOptions {
  coverage: boolean;
  maxJestWorkers?: string;
  preserveConsole?: boolean;
  skipTest?: boolean;
  skipLint?: boolean;
}

const bundlePlugin = (options: PluginBundleOptions) => useSpinner('Compiling...', () => bundleFn(options));

// @ts-ignore
const typecheckPlugin = () => useSpinner('Typechecking', () => execa('tsc', ['--noEmit']));

// @ts-ignore
const getStylesSources = () => globby(resolvePath(process.cwd(), 'src/**/*.+(scss|css)'));

export const pluginBuildRunner: TaskRunner<PluginBuildOptions> = async ({
  coverage,
  maxJestWorkers,
  preserveConsole,
  skipTest,
}) => {
  if (!skipTest) {
    await testPlugin({ updateSnapshot: false, coverage, maxWorkers: maxJestWorkers, watch: false });
  }
  await bundlePlugin({ watch: false, production: true, preserveConsole });
};

export const pluginBuildTask = new Task<PluginBuildOptions>('Build plugin', pluginBuildRunner);
