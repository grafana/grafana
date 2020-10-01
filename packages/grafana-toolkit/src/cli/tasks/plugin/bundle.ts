import webpack = require('webpack');
import formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
import clearConsole = require('react-dev-utils/clearConsole');
import { loadWebpackConfig } from '../../../config/webpack.plugin.config';

export interface PluginBundleOptions {
  watch: boolean;
  production?: boolean;
  yarnlink?: boolean;
}

// export const bundlePlugin = ({ watch, production }: PluginBundleOptions) => useSpinner('Bundle plugin', async () => {
export const bundlePlugin = async ({ watch, production }: PluginBundleOptions) => {
  const compiler = webpack(
    await loadWebpackConfig({
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

      compiler.hooks.done.tap('done', (stats: webpack.Stats) => {
        clearConsole();
        const json: any = stats.toJson(); // different @types/webpack between react-dev-utils and grafana-toolkit
        const output = formatWebpackMessages(json);

        if (!output.errors.length && !output.warnings.length) {
          console.log('Compiled successfully!\n');
          console.log(stats.toString({ colors: true }));
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

          return;
        }
        if (stats.hasErrors()) {
          stats.compilation.errors.forEach(e => {
            console.log(e.message);
          });

          reject('Build failed');
        }
        console.log('\n', stats.toString({ colors: true }), '\n');
        resolve();
      });
    }
  });

  return webpackPromise;
};
