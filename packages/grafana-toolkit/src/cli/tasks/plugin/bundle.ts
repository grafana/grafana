import path = require('path');
import * as jestCLI from 'jest-cli';
import * as rollup from 'rollup';
import { inputOptions, outputOptions } from '../../../config/rollup.plugin.config';

export interface PluginBundleOptions {
  watch: boolean;
}

export const bundlePlugin = async ({ watch }: PluginBundleOptions) => {
  if (watch) {
    const watcher = rollup.watch([
      {
        ...inputOptions(),
        output: outputOptions,
        watch: {
          chokidar: true,
          clearScreen: true,
        },
      },
    ]);
  } else {
    // @ts-ignore
    const bundle = await rollup.rollup(inputOptions());
    // TODO: we can work on more verbose output
    await bundle.generate(outputOptions);
    await bundle.write(outputOptions);
  }
};
