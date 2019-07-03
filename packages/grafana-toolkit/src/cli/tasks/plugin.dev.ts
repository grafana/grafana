import { Task, TaskRunner } from './task';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { useSpinner } from '../utils/useSpinner';

// @ts-ignore
import execa = require('execa');
import path = require('path');

const bundlePlugin = useSpinner<PluginBundleOptions>('Bundling plugin in dev mode', options => {
  return bundleFn(options);
});

const yarnlink = useSpinner<void>('Linking local toolkit', async () => {
  // await execa('yarn', ['remove', '@grafana/toolkit']);

  // Add all the same dependencies as toolkit
  let args: string[] = ['add'];
  const packages = require(path.resolve(__dirname, '../../../package.json'));
  for (const [key, value] of Object.entries(packages.dependencies)) {
    args.push(`${key}@${value}`);
  }
  await execa('yarn', args);
  await execa('yarn', ['link', '@grafana/toolkit']);

  console.log('Added the same dependencies.  Do not checkin this package.json');

  return Promise.resolve();
});

const pluginDevRunner: TaskRunner<PluginBundleOptions> = async options => {
  if (options.yarnlink) {
    return yarnlink();
  }

  if (options.watch) {
    await bundleFn(options);
  } else {
    const result = await bundlePlugin(options);
    return result;
  }
};

export const pluginDevTask = new Task<PluginBundleOptions>('Dev plugin', pluginDevRunner);
