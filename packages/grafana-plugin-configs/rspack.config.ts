import rspack, { type Configuration, type DevServer } from '@rspack/core';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import ESLintPlugin from 'eslint-webpack-plugin';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import { RspackVirtualModulePlugin } from 'rspack-plugin-virtual-module';
import TerserPlugin from 'terser-webpack-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';

import { DIST_DIR } from './constants.ts';
import { getPackageJson, getPluginJson, getEntries, hasLicense } from './utils.ts';

const pluginJson = getPluginJson();
const pkgJson = getPackageJson();

const virtualPublicPath = new RspackVirtualModulePlugin({
  'grafana-public-path': `
import amdMetaModule from 'amd-module';

__webpack_public_path__ =
  amdMetaModule && amdMetaModule.uri
    ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
    : 'public/plugins/${pluginJson.id}/';
`,
});

const devServer: DevServer = {
  hot: true,
  port: 8081,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
  client: {
    overlay: false,
  },
  historyApiFallback: true,
  devMiddleware: {
    publicPath: `/${pluginJson.id}/${pkgJson.version}/public/plugins/${pluginJson.id}`,
  },
};

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig: Configuration = {
    amd: {},

    context: process.cwd(),

    devtool: env.production ? 'source-map' : 'eval-source-map',

    entry: await getEntries(),

    externals: [
      // Required for dynamic publicPath resolution
      { 'amd-module': 'module' },
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
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-redux',
      'redux',
      'rxjs',
      'rxjs/operators',
      'react-router',
      'd3',
      /^@grafana\/ui/i,
      /^@grafana\/runtime/i,
      /^@grafana\/data/i,

      // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
      //@ts-ignore - rspack types seem to be a bit broken here.
      ({ request }, callback) => {
        const prefix = 'grafana/';
        const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
        const stripPrefix = (request: string) => request.substr(prefix.length);

        if (request && hasPrefix(request)) {
          return callback(undefined, stripPrefix(request));
        }

        callback();
      },
    ],

    // Support WebAssembly according to latest spec - makes WebAssembly module async
    experiments: {
      asyncWebAssembly: true,
    },

    mode: env.production ? 'production' : 'development',

    module: {
      rules: [
        // This must come first in the rules array otherwise it breaks sourcemaps.
        {
          test: /module\.tsx?$/,
          use: [
            {
              loader: 'imports-loader',
              options: {
                imports: `side-effects grafana-public-path`,
              },
            },
          ],
        },
        {
          test: /\.tsx$/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  jsx: true,
                },
                externalHelpers: true,
                preserveAllComments: false,
                transform: {
                  react: {
                    runtime: 'automatic',
                    throwIfNamespace: true,
                    useBuiltins: false,
                  },
                },
              },
            },
          },
          type: 'javascript/auto',
        },
        {
          test: /\.ts$/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                },
                externalHelpers: true,
                preserveAllComments: false,
              },
            },
          },
          type: 'javascript/auto',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.s[ac]ss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
          generator: {
            filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
          },
        },
      ],
    },

    optimization: {
      minimize: Boolean(env.production),
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: (_, { type, value }) => type === 'comment2' && value.trim().startsWith('[create-plugin]'),
            },
            compress: {
              drop_console: ['log', 'info'],
            },
          },
        }),
      ],
    },

    output: {
      clean: {
        keep: new RegExp(`(.*?_(amd64|arm(64)?)(.exe)?|go_plugin_build_manifest)`),
      },
      filename: '[name].js',
      library: {
        type: 'amd',
      },
      path: path.resolve(process.cwd(), DIST_DIR),
      publicPath: `public/plugins/${pluginJson.id}/`,
      uniqueName: pluginJson.id,
    },

    plugins: [
      virtualPublicPath,
      // Insert create plugin version information into the bundle
      new rspack.BannerPlugin({
        banner: '/* [create-plugin] version: 5.22.0 */',
        raw: true,
        entryOnly: true,
      }),
      new rspack.CopyRspackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: hasLicense() ? 'LICENSE' : '../../../../../LICENSE', to: '.' }, // Point to Grafana License by default
          { from: 'CHANGELOG.md', to: '.', force: true },
          {
            from: '**/*.json',
            to: '.',
            globOptions: { ignore: ['**/dist/**', '**/tsconfig.json', '**/package.json', '**/project.json'] },
          },
          { from: '**/*.svg', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: '**/*.png', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: '**/*.html', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: 'img/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: 'libs/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: 'static/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
          { from: '**/query_help.md', to: '.', noErrorOnMissing: true, globOptions: { ignore: ['**/dist/**'] } },
        ],
      }),
      // Replace certain template-variables in the README and plugin.json
      new ReplaceInFileWebpackPlugin([
        {
          dir: DIST_DIR,
          files: ['plugin.json', 'README.md'],
          rules: [
            {
              search: /\%VERSION\%/g,
              replace: pkgJson.version,
            },
            {
              search: /\%TODAY\%/g,
              replace: new Date().toISOString().substring(0, 10),
            },
            {
              search: /\%PLUGIN_ID\%/g,
              replace: pluginJson.id,
            },
          ],
        },
      ]),

      ...(env.development
        ? [
            new ReactRefreshRspackPlugin(),
            new TsCheckerRspackPlugin({
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
          ]
        : []),
    ],

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      // handle resolving "rootDir" paths
      modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
    },

    watchOptions: {
      ignored: ['**/node_modules', '**/dist', '**/.yarn'],
    },
  };

  if (env.development) {
    baseConfig.devServer = devServer;
  }

  return baseConfig;
};

export default config;
