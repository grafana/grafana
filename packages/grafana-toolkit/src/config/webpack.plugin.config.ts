import * as webpack from 'webpack';

import { getStyleLoaders, getStylesheetEntries, getFileLoaders } from './webpack/loaders';

const CopyWebpackPlugin = require('copy-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const util = require('util');

const readdirPromise = util.promisify(fs.readdir);
const accessPromise = util.promisify(fs.access);

export interface WebpackConfigurationOptions {
  watch?: boolean;
  production?: boolean;
  preserveConsole?: boolean;
}

type WebpackConfigurationGetter = (options: WebpackConfigurationOptions) => Promise<webpack.Configuration>;

export type CustomWebpackConfigurationGetter = (
  originalConfig: webpack.Configuration,
  options: WebpackConfigurationOptions
) => webpack.Configuration;

export const findModuleFiles = async (base: string, files?: string[], result?: string[]) => {
  files = files || (await readdirPromise(base));
  result = result || [];

  if (files) {
    await Promise.all(
      files.map(async (file) => {
        const newbase = path.join(base, file);
        if (fs.statSync(newbase).isDirectory()) {
          result = await findModuleFiles(newbase, await readdirPromise(newbase), result);
        } else {
          const filename = path.basename(file);
          if (/^module.(t|j)sx?$/.exec(filename)) {
            // @ts-ignore
            result.push(newbase);
          }
        }
      })
    );
  }
  return result;
};

const getModuleFiles = () => {
  return findModuleFiles(path.resolve(process.cwd(), 'src'));
};

const getManualChunk = (id: string) => {
  if (id.endsWith('module.ts') || id.endsWith('module.js') || id.endsWith('module.tsx')) {
    const idx = id.lastIndexOf(path.sep + 'src' + path.sep);
    if (idx > 0) {
      const name = id.substring(idx + 5, id.lastIndexOf('.'));

      return {
        name,
        module: id,
      };
    }
  }
  return null;
};

const getEntries = async () => {
  const entries: { [key: string]: string } = {};
  const modules = await getModuleFiles();

  modules.forEach((modFile) => {
    const mod = getManualChunk(modFile);
    // @ts-ignore
    entries[mod.name] = mod.module;
  });
  return {
    ...entries,
    ...getStylesheetEntries(),
  };
};

const getCommonPlugins = (options: WebpackConfigurationOptions) => {
  const hasREADME = fs.existsSync(path.resolve(process.cwd(), 'src', 'README.md'));
  const packageJson = require(path.resolve(process.cwd(), 'package.json'));
  return [
    new MiniCssExtractPlugin({
      // both options are optional
      filename: 'styles/[name].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        // If src/README.md exists use it; otherwise the root README
        { from: hasREADME ? 'README.md' : '../README.md', to: '.', force: true, priority: 1, noErrorOnMissing: true },
        { from: 'plugin.json', to: '.', noErrorOnMissing: true },
        { from: '**/README.md', to: '[path]README.md', priority: 0, noErrorOnMissing: true },
        { from: '../LICENSE', to: '.', noErrorOnMissing: true },
        { from: '../CHANGELOG.md', to: '.', force: true, noErrorOnMissing: true },
        { from: '**/*.{json,svg,png,html}', to: '.', noErrorOnMissing: true },
        { from: 'img/**/*', to: '.', noErrorOnMissing: true },
        { from: 'libs/**/*', to: '.', noErrorOnMissing: true },
        { from: 'static/**/*', to: '.', noErrorOnMissing: true },
      ],
    }),

    new ReplaceInFileWebpackPlugin([
      {
        dir: 'dist',
        files: ['plugin.json', 'README.md'],
        rules: [
          {
            search: '%VERSION%',
            replace: packageJson.version,
          },
          {
            search: '%TODAY%',
            replace: new Date().toISOString().substring(0, 10),
          },
        ],
      },
    ]),
    new ForkTsCheckerWebpackPlugin({
      typescript: { configFile: path.join(process.cwd(), 'tsconfig.json') },
      issue: {
        include: [{ file: '**/*.{ts,tsx}' }],
      },
    }),
  ];
};

const getBaseWebpackConfig: WebpackConfigurationGetter = async (options) => {
  const plugins = getCommonPlugins(options);
  const optimization: { [key: string]: any } = {};

  if (options.production) {
    const compressOptions = { drop_console: !options.preserveConsole, drop_debugger: true };
    optimization.minimizer = [
      new TerserPlugin({ terserOptions: { compress: compressOptions } }),
      new CssMinimizerPlugin(),
    ];
    optimization.chunkIds = 'total-size';
    optimization.moduleIds = 'size';
  } else if (options.watch) {
    plugins.push(new HtmlWebpackPlugin());
  }

  return {
    mode: options.production ? 'production' : 'development',
    target: 'web',
    context: path.join(process.cwd(), 'src'),
    devtool: 'source-map',
    entry: await getEntries(),
    output: {
      filename: '[name].js',
      path: path.join(process.cwd(), 'dist'),
      libraryTarget: 'amd',
      publicPath: '/',
    },

    performance: { hints: false },
    externals: [
      'lodash',
      'jquery',
      'moment',
      'slate',
      'emotion',
      '@emotion/react',
      '@emotion/css',
      'prismjs',
      'slate-plain-serializer',
      '@grafana/slate-react',
      'react',
      'react-dom',
      'react-redux',
      'redux',
      'rxjs',
      'react-router',
      'react-router-dom',
      'd3',
      'angular',
      '@grafana/ui',
      '@grafana/runtime',
      '@grafana/data',
      ({ request }, callback) => {
        const prefix = 'grafana/';
        if (request?.indexOf(prefix) === 0) {
          return callback(undefined, request.slice(prefix.length));
        }

        callback();
      },
    ],
    plugins,
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
      fallback: {
        buffer: false,
        fs: false,
        stream: false,
        http: false,
        https: false,
        string_decoder: false,
        os: false,
        timers: false,
      },
    },
    module: {
      rules: [
        {
          test: /\.[tj]sx?$/,
          use: {
            loader: require.resolve('babel-loader'),
            options: {
              cacheDirectory: true,
              cacheCompression: false,
              presets: [
                [require.resolve('@babel/preset-env'), { modules: false }],
                [
                  require.resolve('@babel/preset-typescript'),
                  {
                    allowNamespaces: true,
                    allowDeclareFields: true,
                  },
                ],
                [require.resolve('@babel/preset-react')],
              ],
              plugins: [
                [
                  require.resolve('@babel/plugin-transform-typescript'),
                  {
                    allowNamespaces: true,
                    allowDeclareFields: true,
                  },
                ],
                require.resolve('@babel/plugin-proposal-class-properties'),
                [require.resolve('@babel/plugin-proposal-object-rest-spread'), { loose: true }],
                require.resolve('@babel/plugin-transform-react-constant-elements'),
                require.resolve('@babel/plugin-proposal-nullish-coalescing-operator'),
                require.resolve('@babel/plugin-proposal-optional-chaining'),
                require.resolve('@babel/plugin-syntax-dynamic-import'),
                require.resolve('babel-plugin-angularjs-annotate'),
              ],
            },
          },
          exclude: /node_modules/,
        },
        ...getStyleLoaders(),
        {
          test: /\.html$/,
          exclude: [/node_modules/],
          use: {
            loader: require.resolve('html-loader'),
          },
        },
        ...getFileLoaders(),
      ],
    },
    optimization,
  };
};

export const loadWebpackConfig: WebpackConfigurationGetter = async (options) => {
  const baseConfig = await getBaseWebpackConfig(options);
  const customWebpackPath = path.resolve(process.cwd(), 'webpack.config.js');

  try {
    await accessPromise(customWebpackPath);
    const customConfig = require(customWebpackPath);
    const configGetter = customConfig.getWebpackConfig || customConfig;
    if (typeof configGetter !== 'function') {
      throw Error(
        'Custom webpack config needs to export a function implementing CustomWebpackConfigurationGetter. Function needs to be ' +
          'module export or named "getWebpackConfig"'
      );
    }
    return (configGetter as CustomWebpackConfigurationGetter)(baseConfig, options);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return baseConfig;
    }
    throw err;
  }
};
