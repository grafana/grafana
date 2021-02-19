import { Task, TaskRunner } from './task';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { useSpinner } from '../utils/useSpinner';
import { lintPlugin } from './plugin.build';
// @ts-ignore
import allSettled from 'promise.allsettled';

// @ts-ignore
import execa = require('execa');
import path = require('path');

const bundlePlugin = useSpinner<PluginBundleOptions>('Bundling plugin in dev mode', options => {
  return bundleFn(options);
});

const yarnlink = useSpinner<void>('Linking local toolkit', async () => {
  const existingDeps: string[] = ['@grafana/eslint-config', '@grafana/toolkit', '@grafana/tsconfig'];

  // Remove published dependencies
  // @todo https://github.com/es-shims/Promise.allSettled/issues/5
  await allSettled.call(
    Promise,
    existingDeps.map(async dep => {
      try {
        await execa('yarn', ['remove', dep]);
      } catch ({ message }) {
        console.log('\n', message, '\n');
      }
    })
  );

  // Link to local -- must have been manually linked (see README)
  await execa('yarn', ['link', ...existingDeps]);

  const newDeps: string[] = existingDeps
    .map(dep => require(`${dep}/package.json`))
    .map(({ dependencies = {} }) => Object.entries(dependencies))
    .flat()
    // @todo dedupe, excluding older versions
    .map(([key, value]) => `${key}@${value}`);

  // Add all the nested dependencies
  await execa('yarn', ['add', ...newDeps]);

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
