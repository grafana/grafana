import CopyWebpackPlugin from 'copy-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import { Configuration } from 'webpack';

const SOURCE_DIR = path.resolve(__dirname, 'src');
const DIST_DIR = path.resolve(__dirname, 'dist');
const PLUGIN_ID = require(path.join(SOURCE_DIR, 'plugin.json')).id;

const config = async (env: Record<string, string>): Promise<Configuration> => ({
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },

  context: path.join(process.cwd(), SOURCE_DIR),

  devtool: env.production ? 'source-map' : 'eval-source-map',

  entry: {
    module: path.join(SOURCE_DIR, 'module.ts'),
  },

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

    // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
    ({ request }, callback) => {
      const prefix = 'grafana/';
      const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
      const stripPrefix = (request: string) => request.substring(prefix.length);

      if (request && hasPrefix(request)) {
        return callback(undefined, stripPrefix(request));
      }

      callback();
    },
  ],

  mode: env.production ? 'production' : 'development',

  module: {
    rules: [
      {
        exclude: /(node_modules)/,
        test: /\.[tj]sx?$/,
        use: {
          loader: 'ts-loader',
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          // Keep publicPath relative for host.com/grafana/ deployments
          publicPath: `public/plugins/${PLUGIN_ID}/img/`,
          outputPath: 'img/',
          filename: Boolean(env.production) ? '[hash][ext]' : '[name][ext]',
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          // Keep publicPath relative for host.com/grafana/ deployments
          publicPath: `public/plugins/${PLUGIN_ID}/fonts`,
          outputPath: 'fonts/',
          filename: Boolean(env.production) ? '[hash][ext]' : '[name][ext]',
        },
      },
    ],
  },

  output: {
    clean: {
      keep: new RegExp(`.*?_(amd64|arm(64)?)(.exe)?`),
    },
    filename: '[name].js',
    library: {
      type: 'amd',
    },
    path: DIST_DIR,
    publicPath: '/',
  },

  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: '../README.md', to: '.', force: true, context: SOURCE_DIR },
        { from: 'plugin.json', to: '.', context: SOURCE_DIR },
        { from: '**/*.json', to: '.', context: SOURCE_DIR },
        { from: '**/*.svg', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
        { from: '**/*.png', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
        { from: '**/*.html', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
        { from: 'img/**/*', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
        { from: 'libs/**/*', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
        { from: 'static/**/*', to: '.', noErrorOnMissing: true, context: SOURCE_DIR }, // Optional
      ],
    }),
    new ForkTsCheckerWebpackPlugin({
      async: Boolean(env.development),
      issue: {
        include: [{ file: '**/*.{ts,tsx}' }],
      },
      typescript: { configFile: path.join(process.cwd(), 'tsconfig.json') },
    }),
    new ESLintPlugin({
      extensions: ['.ts', '.tsx'],
      lintDirtyModulesOnly: Boolean(env.development), // don't lint on start, only lint changed files
    }),
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    // handle resolving "rootDir" paths
    modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
    unsafeCache: true,
  },
});

export default config;
