import clearConsole from 'react-dev-utils/clearConsole';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import webpack from 'webpack';

import { loadWebpackConfig } from '../../../config/webpack.plugin.config';

export interface PluginBundleOptions {
  watch: boolean;
  production?: boolean;
  preserveConsole?: boolean;
}

export const bundlePlugin = async ({ watch, production, preserveConsole }: PluginBundleOptions) => {
  const compiler = webpack(
    await loadWebpackConfig({
      watch,
      production,
      preserveConsole,
    })
  );

  const webpackPromise = new Promise<void>((resolve, reject) => {
    if (watch) {
      console.log('Started watching plugin for changes...');
      compiler.watch({ ignored: ['**/node_modules', '**/dist'] }, (err, stats) => {});

      compiler.hooks.invalid.tap('invalid', () => {
        clearConsole();
        console.log('Compiling...');
      });

      compiler.hooks.done.tap('done', (stats) => {
        clearConsole();
        const json = stats.toJson();
        const output = formatWebpackMessages(json);

        if (!output.errors.length && !output.warnings.length) {
          console.log('Compiled successfully!\n');
          console.log(stats.toString({ colors: true }));
        }

        if (output.errors.length) {
          console.log('Compilation failed!');
          output.errors.forEach((e) => console.log(e));

          if (output.warnings.length) {
            console.log('Warnings:');
            output.warnings.forEach((w) => console.log(w));
          }
        }
        if (output.errors.length === 0 && output.warnings.length) {
          console.log('Compiled with warnings!');
          output.warnings.forEach((w) => console.log(w));
        }
      });
    } else {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        if (stats?.hasErrors()) {
          stats.compilation.errors.forEach((e) => {
            console.log(e.message);
          });

          reject('Build failed');
          return;
        }

        console.log('\n', stats?.toString({ colors: true }), '\n');
        resolve();
      });
    }
  });

  return webpackPromise;
};
