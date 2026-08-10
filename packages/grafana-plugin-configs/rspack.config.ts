import rspack, { type Configuration, type Compiler } from '@rspack/core';
import ESLintPlugin from 'eslint-rspack-plugin';
import fs from 'fs';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

import { DIST_DIR } from './constants.ts';
import { getPackageJson, getPluginJson, getEntries, hasLicense } from './utils.ts';

// CopyRspackPlugin has no `filter` option (unlike copy-webpack-plugin), so the
// equivalent of the webpack config's `skipFiles` filter is expressed as glob
// ignores instead.
const copyIgnore = ['**/dist/**', '**/tsconfig.json', '**/package.json', '**/project.json'];

class BuildModeRspackPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('BuildModeRspackPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'BuildModeRspackPlugin',
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
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
              compilation.updateAsset(asset.name, new rspack.sources.RawSource(pluginJsonWithBuildMode));
            }
          }
        }
      );
    });
  }
}

// CopyRspackPlugin recursively scans the *parent directory* of a single-file
// `from`, so a pattern for the repo-root LICENSE walks the whole monorepo. On
// @rspack/core 2.1.7 that measures ~3.9s per plugin build, repeated on every
// watch rebuild (it was ~16s on 2.1.1). Emitting the file directly avoids the
// scan. Plugins that ship their own LICENSE copy it normally — that `from`
// resolves inside the plugin directory.
class EmitLicenseRspackPlugin {
  apply(compiler: Compiler) {
    const licensePath = path.resolve(import.meta.dirname, '../../LICENSE');
    compiler.hooks.compilation.tap('EmitLicenseRspackPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'EmitLicenseRspackPlugin',
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          if (!compilation.getAsset('LICENSE')) {
            compilation.emitAsset('LICENSE', new rspack.sources.RawSource(fs.readFileSync(licensePath, 'utf-8')));
          }
        }
      );
    });
  }
}

export type Env = {
  [key: string]: true | string | Env;
};

const config = async (env: Env, pluginDir = process.cwd()): Promise<Configuration> => {
  const pluginJson = getPluginJson(pluginDir);
  // Inject module. rspack ships a native equivalent of webpack-virtual-modules
  // with the same constructor shape.
  const virtualPublicPath = new rspack.experiments.VirtualModulesPlugin({
    'node_modules/grafana-public-path.js': `
  import amdMetaModule from 'amd-module';

  __webpack_public_path__ =
    amdMetaModule && amdMetaModule.uri
      ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
      : 'public/plugins/${pluginJson.id}/';
  `,
  });

  const baseConfig: Configuration = {
    // No `cache` block: rspack's persistent cache is still experimental
    // (`experiments.cache`) and the cold builds are fast enough without it.

    // rspack only resolves the `define.amd` branch of a UMD wrapper at build
    // time when AMD support is on. Without this, the check is left in the
    // bundle and evaluated at load time, where the global `define` SystemJS
    // installs makes it truthy: the dep registers with SystemJS, exports
    // nothing, and the plugin throws.
    amd: {},

    context: process.cwd(),

    devtool: env.production ? 'source-map' : 'eval-source-map',

    entry: await getEntries(pluginDir),

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
        new rspack.SwcJsMinimizerRspackPlugin({
          // TerserPlugin extracts third-party @license banners into a
          // <asset>.LICENSE.txt sidecar by default; rspack's minimizer does
          // not, and `format.comments: false` below would otherwise drop those
          // notices from the shipped bundle entirely.
          extractComments: true,
          minimizerOptions: {
            format: {
              // swc's `comments` only takes false | 'some' | 'all' — there is
              // no terser-style predicate to keep the [create-plugin] banner,
              // so all comments are dropped here and the banner is re-added
              // after minification by the BannerPlugin below.
              comments: false,
            },
            compress: {
              // swc's `drop_console` is boolean-only and would drop warn and
              // error too. pure_funcs matches terser's
              // `drop_console: ['log', 'info']`.
              pure_funcs: ['console.log', 'console.info'],
            },
          },
        }),
      ],
    },

    plugins: [
      virtualPublicPath,
      // Insert create plugin version information into the bundle so Grafana will load from cdn with script tags.
      new rspack.BannerPlugin({
        banner: '/* [create-plugin] version: 5.22.0 */',
        raw: true,
        entryOnly: true,
        // Run after the minimizer (PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE) so the
        // banner survives `format.comments: false`.
        stage: rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
      }),
      new rspack.CopyRspackPlugin({
        patterns: [
          // To `compiler.options.output`
          { from: 'README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          // Plugins without their own LICENSE get the repo-root Grafana
          // LICENSE from EmitLicenseRspackPlugin instead of a copy pattern.
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
              // eslint-rspack-plugin 5.x dropped `failOnError`; downgrading
              // errors to warnings is the equivalent of `failOnError: false`.
              severity: {
                error: 'warning',
              },
            }),
          ]
        : []),
    ],

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      conditionNames: ['@grafana-app/source', '...'],
      // webpack's `resolve.unsafeCache` has no rspack equivalent; rspack caches
      // resolution natively.
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
