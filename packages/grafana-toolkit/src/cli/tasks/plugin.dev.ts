import { Task, TaskRunner } from './task';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { useSpinner } from '../utils/useSpinner';
import { lintPlugin } from './plugin.build';

// @ts-ignore
import execa = require('execa');
import path = require('path');

const bundlePlugin = (options: PluginBundleOptions) =>
  useSpinner('Bundling plugin in dev mode', () => bundleFn(options));

const yarnlink = () =>
  useSpinner('Linking local toolkit', async () => {
    try {
      // Make sure we are not using package.json defined toolkit
      await execa('yarn', ['remove', '@grafana/toolkit']);
    } catch (e) {
      console.log('\n', e.message, '\n');
    }
    await execa('yarn', ['link', '@grafana/toolkit']);

    // Add all the same dependencies as toolkit
    const args: string[] = ['add'];
    const packages = require(path.resolve(__dirname, '../../../package.json'));
    for (const [key, value] of Object.entries(packages.dependencies)) {
      args.push(`${key}@${value}`);
    }
    await execa('yarn', args);

    console.log('Added dependencies required by local @grafana/toolkit.  Do not checkin this package.json!');
  });

const pluginDevRunner: TaskRunner<PluginBundleOptions> = async options => {
  if (options.yarnlink) {
    return yarnlink();
  }

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
