import rspack, { type Configuration, type Compiler } from '@rspack/core';
import ESLintPlugin from 'eslint-rspack-plugin';
import fs from 'fs';
import { createRequire } from 'node:module';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

import { DIST_DIR } from './constants.ts';
import { getPackageJson, getPluginJson, getEntries, hasLicense } from './utils.ts';

const require = createRequire(import.meta.url);

const copyIgnore = ['**/dist/**', '**/tsconfig.json', '**/package.json', '**/project.json'];

class BuildModeRspackPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('BuildModeRspackPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'BuildModeRspackPlugin',
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        async () => {
          const assets = compilation.getAssets();
          for (const asset of assets) {
            if (asset.name.endsWith('plugin.json')) {
              const pluginJsonString = asset.source.source().toString();
              const pluginJsonWithBuildMode = JSON.stringify(
                {
                  ...JSON.parse(pluginJsonString),
                  buildMode: compilation.options.mode,
                },
                null,
                4
              );
              compilation.updateAsset(asset.name, new compiler.rspack.sources.RawSource(pluginJsonWithBuildMode));
            }
          }
        }
      );
    });
  }
}

// A CopyRspackPlugin pattern for the repo-root LICENSE scans the whole monorepo, so emit it directly.
class EmitLicenseRspackPlugin {
  apply(compiler: Compiler) {
    const licensePath = path.resolve(import.meta.dirname, '../../LICENSE');
    compiler.hooks.compilation.tap('EmitLicenseRspackPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'EmitLicenseRspackPlugin',
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          if (!compilation.getAsset('LICENSE')) {
            compilation.emitAsset(
              'LICENSE',
              new compiler.rspack.sources.RawSource(fs.readFileSync(licensePath, 'utf-8'))
            );
          }
        }
      );
    });
  }
}

// Use `compiler.rspack`: virtual modules only register with the @rspack/core copy that created them.
class PublicPathRspackPlugin {
  constructor(private pluginId: string) {}

  apply(compiler: Compiler) {
    new compiler.rspack.experiments.VirtualModulesPlugin({
      'node_modules/grafana-public-path.js': `
  import amdMetaModule from 'amd-module';

  __webpack_public_path__ =
    amdMetaModule && amdMetaModule.uri
      ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
      : 'public/plugins/${this.pluginId}/';
  `,
    }).apply(compiler);
  }
}

export type Env = {
  [key: string]: true | string | Env;
};

const config = async (env: Env, pluginDir = process.cwd()): Promise<Configuration> => {
  const pluginJson = getPluginJson(pluginDir);
  const baseConfig: Configuration = {
    // Without this, SystemJS's global `define` makes bundled UMD deps export nothing.
    amd: {},

    context: process.cwd(),

    devtool: env.production ? 'source-map' : 'eval-source-map',

    entry: await getEntries(pluginDir),

    externals: [
      // Required for dynamic publicPath resolution
      { 'amd-module': 'module' },
      'lodash',
      'jquery',
      // moment stays external (served lazily by the runtime's shared dependencies), except when
      // imported by @react-awesome-query-builder, which is redirected to a luxon-backed compat
      // adapter through the `moment$` resolve alias below so SQL plugins don't load real moment.
      ({ context, request }, callback) => {
        if (request === 'moment' && !context?.includes('@react-awesome-query-builder')) {
          return callback(undefined, 'moment');
        }

        callback();
      },
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
              loader: require.resolve('imports-loader'),
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
            loader: 'builtin:swc-loader',
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
          use: [require.resolve('style-loader'), require.resolve('css-loader')],
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
        new rspack.SwcJsMinimizerRspackPlugin({
          // Match Terser's .LICENSE.txt sidecar
          extractComments: true,
          minimizerOptions: {
            format: {
              comments: false,
            },
            compress: {
              // Match Terser's `drop_console: ['log', 'info']`
              pure_funcs: ['console.log', 'console.info'],
            },
          },
        }),
      ],
    },

    plugins: [
      // Inject module
      new PublicPathRspackPlugin(pluginJson.id),
      // Insert create plugin version information into the bundle so Grafana will load from cdn with script tags.
      new rspack.BannerPlugin({
        banner: '/* [create-plugin] version: 5.22.0 */',
        raw: true,
        entryOnly: true,
        // Run after the minimizer, which strips all comments
        stage: rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
      }),
      new rspack.CopyRspackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          ...(hasLicense(pluginDir) ? [{ from: 'LICENSE', to: '.' }] : []),
          { from: 'CHANGELOG.md', to: '.', force: true },
          { from: '**/*.json', to: '.', globOptions: { ignore: copyIgnore } }, // TODO<Add an error for checking the basic structure of the repo>
          { from: '**/*.svg', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: '**/*.png', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: '**/*.html', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: 'img/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: 'libs/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: 'schema/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
          { from: 'static/**/*', to: '.', noErrorOnMissing: true, globOptions: { ignore: copyIgnore } }, // Optional
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
              replace: env.commit
                ? `${getPackageJson(pluginDir).version}-${env.commit}`
                : getPackageJson(pluginDir).version,
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
      // Add buildMode to plugin.json
      new BuildModeRspackPlugin(),
      ...(hasLicense(pluginDir) ? [] : [new EmitLicenseRspackPlugin()]),
      ...(env.development
        ? [
            new TsCheckerRspackPlugin({
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
                '../../node_modules/.cache/eslint-rspack-plugin',
                path.basename(process.cwd()),
                '.eslintcache'
              ),
              configType: 'flat',
              severity: {
                error: 'warning',
              },
            }),
          ]
        : []),
    ],

    resolve: {
      // only reachable from @react-awesome-query-builder imports; all other moment imports are
      // externalized before resolution (see externals above)
      alias: {
        moment$: path.resolve(import.meta.dirname, '../grafana-sql/src/utils/raqbMomentCompat.ts'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      conditionNames: ['@grafana-app/source', '...'],
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
