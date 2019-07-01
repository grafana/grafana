import path = require('path');
import fs = require('fs');
import webpack = require('webpack');
import { getWebpackConfig } from '../../../config/webpack.plugin.config';
import { useSpinner } from '../../utils/useSpinner';

export interface PluginBundleOptions {
  watch: boolean;
}

export const bundlePlugin = useSpinner<PluginBundleOptions>('Bundle plugin', ({ watch }) => {
  const compiler = webpack(getWebpackConfig());

  const webpackPromise = new Promise<void>((resolve, reject) => {
    compiler.run((err: Error, stats: webpack.Stats) => {
      if (err) {
        reject(err.message);
      }
      if (stats.hasErrors()) {
        stats.compilation.errors.forEach(e => {
          console.log(e.message);
        });

        reject('Build failed');
      }
      resolve();
    });
  });

  return webpackPromise;
});
