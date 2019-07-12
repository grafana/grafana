import webpack = require('webpack');
import { getWebpackConfig } from '../../../config/webpack.plugin.config';
import formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
import clearConsole = require('react-dev-utils/clearConsole');

export interface PluginBundleOptions {
  watch: boolean;
  production?: boolean;
  yarnlink?: boolean;
}

// export const bundlePlugin = useSpinner<PluginBundleOptions>('Bundle plugin', ({ watch }) => {
export const bundlePlugin = async ({ watch, production }: PluginBundleOptions) => {
  const compiler = webpack(
    getWebpackConfig({
      watch,
      production,
    })
  );

  const webpackPromise = new Promise<void>((resolve, reject) => {
    if (watch) {
      console.log('Started watching plugin for changes...');
      compiler.watch({}, (err, stats) => {});

      compiler.hooks.invalid.tap('invalid', () => {
        clearConsole();
        console.log('Compiling...');
      });

      compiler.hooks.done.tap('done', stats => {
        clearConsole();
        const output = formatWebpackMessages(stats.toJson());

        if (!output.errors.length && !output.warnings.length) {
          console.log('Compiled successfully!');
        }

        if (output.errors.length) {
          console.log('Compilation failed!');
          output.errors.forEach(e => console.log(e));
          if (output.warnings.length) {
            console.log('Warnings:');
            output.warnings.forEach(w => console.log(w));
          }
        }
        if (output.errors.length === 0 && output.warnings.length) {
          console.log('Compiled with warnings!');
          output.warnings.forEach(w => console.log(w));
        }
      });
    } else {
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
    }
  });

  return webpackPromise;
};
