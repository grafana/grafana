import CopyWebpackPlugin from 'copy-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import webpack, { type Configuration } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { DIST_DIR } from './constants.ts';
import { getPackageJson, getPluginJson, getEntries, hasLicense } from './utils.ts';

function skipFiles(f: string): boolean {
  if (f.includes('/dist/')) {
    // avoid copying files already in dist
    return false;
  }
  if (f.includes('/tsconfig.json')) {
    // avoid copying tsconfig.json
    return false;
  }
  if (f.includes('/package.json')) {
    // avoid copying package.json
    return false;
  }
  if (f.includes('/project.json')) {
    // avoid copying project.json
    return false;
  }
  return true;
}

export type Env = {
  [key: string]: true | string | Env;
};

const config = async (env: Env): Promise<Configuration> => {
  const pluginJson = getPluginJson();
  // Inject module
  const virtualPublicPath = new VirtualModulesPlugin({
    'node_modules/grafana-public-path.js': `
  import amdMetaModule from 'amd-module';

  __webpack_public_path__ =
    amdMetaModule && amdMetaModule.uri
      ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
      : 'public/plugins/${pluginJson.id}/';
  `,
  });

  const baseConfig: Configuration = {
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [import.meta.filename],
      },
      cacheDirectory: path.resolve(
        import.meta.dirname,
        '../../node_modules/.cache/webpack',
        path.basename(process.cwd())
      ),
    },

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
      ({ request }, callback) => {
        const prefix = 'grafana/';
        const hasPrefix = (request?: string) => request?.indexOf(prefix) === 0;
        const stripPrefix = (request?: string) => request?.substr(prefix.length);

        if (hasPrefix(request)) {
          return callback(undefined, stripPrefix(request));
        }

        callback();
      },
    ],

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
          exclude: /(node_modules)/,
          test: /\.[tj]sx?$/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                baseUrl: path.resolve(import.meta.dirname),
                target: 'es2015',
                loose: false,
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  decorators: false,
                  dynamicImport: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                  },
                },
              },
            },
          },
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
            // Keep publicPath relative for host.com/grafana/ deployments
            publicPath: `public/plugins/${pluginJson.id}/img/`,
            outputPath: 'img/',
            filename: Boolean(env.production) ? '[hash][ext]' : '[name][ext]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
          generator: {
            // Keep publicPath relative for host.com/grafana/ deployments
            publicPath: `public/plugins/${pluginJson.id}/fonts/`,
            outputPath: 'fonts/',
            filename: Boolean(env.production) ? '[hash][ext]' : '[name][ext]',
          },
        },
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

    plugins: [
      virtualPublicPath,
      // Insert create plugin version information into the bundle so Grafana will load from cdn with script tags.
      new webpack.BannerPlugin({
        banner: '/* [create-plugin] version: 5.22.0 */',
        raw: true,
        entryOnly: true,
      }),
      new CopyWebpackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: hasLicense() ? 'LICENSE' : '../../../../../LICENSE', to: '.' }, // Point to Grafana License by default
          { from: 'CHANGELOG.md', to: '.', force: true },
          { from: '**/*.json', to: '.', filter: skipFiles }, // TODO<Add an error for checking the basic structure of the repo>
          { from: '**/*.svg', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
          { from: '**/*.png', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
          { from: '**/*.html', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
          { from: 'img/**/*', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
          { from: 'libs/**/*', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
          { from: 'static/**/*', to: '.', noErrorOnMissing: true, filter: skipFiles }, // Optional
        ],
      }),
      // Replace certain template-variables in the README and plugin.json
      new ReplaceInFileWebpackPlugin([
        {
          dir: path.resolve(DIST_DIR),
          files: ['plugin.json', 'README.md'],
          rules: [
            {
              search: /\%VERSION\%/g,
              replace: env.commit ? `${getPackageJson().version}-${env.commit}` : getPackageJson().version,
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
            new ForkTsCheckerWebpackPlugin({
              async: true,
              issue: {
                include: [{ file: '**/*.{ts,tsx}' }],
              },
              typescript: { configFile: path.join(process.cwd(), 'tsconfig.json') },
            }),
            new ESLintPlugin({
              extensions: ['.ts', '.tsx'],
              lintDirtyModulesOnly: true, // don't lint on start, only lint changed files
              cacheLocation: path.resolve(
                import.meta.dirname,
                '../../node_modules/.cache/eslint-webpack-plugin',
                path.basename(process.cwd()),
                '.eslintcache'
              ),
              configType: 'flat',
              failOnError: false,
            }),
          ]
        : []),
    ],

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      unsafeCache: true,
    },

    stats: 'minimal',

    watchOptions: {
      ignored: ['**/node_modules', '**/dist', '**/.yarn'],
    },
  };

  if (env.stats) {
    baseConfig.stats = 'normal';
    baseConfig.plugins?.push(new BundleAnalyzerPlugin());
  }

  return baseConfig;
};

export default config;
