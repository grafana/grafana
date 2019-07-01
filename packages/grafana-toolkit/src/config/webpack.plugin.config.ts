const fs = require('fs');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');
import * as webpack from 'webpack';

type WebpackConfigurationGetter = () => webpack.Configuration;

const findModuleTs = (base: string, files?: string[], result?: string[]) => {
  files = files || fs.readdirSync(base);
  result = result || [];

  if (files) {
    files.forEach(file => {
      const newbase = path.join(base, file);
      if (fs.statSync(newbase).isDirectory()) {
        result = findModuleTs(newbase, fs.readdirSync(newbase), result);
      } else {
        if (file.indexOf('module.ts') > -1) {
          // @ts-ignore
          result.push(newbase);
        }
      }
    });
  }
  return result;
};

const getModuleFiles = () => {
  return findModuleTs(path.resolve(process.cwd(), 'src'));
};

const getManualChunk = (id: string) => {
  if (id.endsWith('module.ts') || id.endsWith('module.tsx')) {
    const idx = id.indexOf('/src/');
    if (idx > 0) {
      const name = id.substring(idx + 5, id.lastIndexOf('.'));

      return {
        name,
        module: id,
      };
    }
  }
};
const getEntries = () => {
  const entries: { [key: string]: string } = {};
  const modules = getModuleFiles();

  modules.forEach(modFile => {
    const mod = getManualChunk(modFile);
    // @ts-ignore
    entries[mod.name] = mod.module;
  });
  return entries;
};

export const getWebpackConfig: WebpackConfigurationGetter = () => {
  const packageJson = require(path.resolve(process.cwd(), 'package.json'));

  return {
    mode: 'development',
    target: 'web',
    node: {
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
    },
    context: path.join(process.cwd(), 'src'),
    devtool: 'source-map',
    entry: getEntries(),
    output: {
      filename: '[name].js',
      path: path.join(process.cwd(), 'dist'),
      libraryTarget: 'amd',
    },

    performance: { hints: false },
    externals: [
      'lodash',
      'jquery',
      'moment',
      'slate',
      'prismjs',
      'slate-plain-serializer',
      'slate-react',
      'react',
      'react-dom',
      'jquery',
      'rxjs',
      'd3',
      '@grafana/ui',
      '@grafana/runtime',
      '@grafana/data',
      // @ts-ignore
      (context, request, callback) => {
        const prefix = 'app/';
        const prefix2 = 'grafana/';
        if (request.indexOf(prefix) === 0 || request.indexOf(prefix2) === 0) {
          return callback(null, request);
        }
        // @ts-ignore
        callback();
      },
    ],
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(true),

      new CopyWebpackPlugin([
        { from: 'plugin.json', to: '.' },
        { from: '../README.md', to: '.' },
        { from: '../LICENSE', to: '.' },
        { from: 'partials/*', to: '.' },
        { from: 'img/*', to: '.' },
      ]),

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
    ],
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loaders: [
            {
              loader: 'babel-loader',
              options: { presets: ['@babel/preset-env'] },
            },
            'ts-loader',
          ],
          exclude: /(node_modules)/,
        },
        {
          test: /\.css$/,
          use: [
            {
              loader: 'style-loader',
            },
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                sourceMap: true,
              },
            },
          ],
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
      ],
    },
  };
};
