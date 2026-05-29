import type { KnipConfig } from 'knip';

const packageIgnoreDeps = [
  // These are used by the base rollup config located outside of the packages
  '@rollup/plugin-node-resolve',
  'rollup-plugin-esbuild',
  'rollup-plugin-node-externals',
];

const packageEntries = ['i18next.config.ts'];

const externalisedDatasources = [
  'azuremonitor',
  'cloud-monitoring',
  'grafana-postgresql-datasource',
  'grafana-pyroscope-datasource',
  'grafana-testdata-datasource',
  'graphite',
  'influxdb',
  'jaeger',
  'loki',
  'mssql',
  'mysql',
  'opentsdb',
  'parca',
  'tempo',
];

const config: KnipConfig = {
  compilers: {
    mdx: true,
  },
  exclude: [
    // we don't often use enums, but when we do we usually include members we'll utilise in the future
    'enumMembers',
  ],
  ignore: ['**/*.gen.ts*', '**/*_gen.ts*'],
  ignoreBinaries: ['make', 'shellcheck'],
  workspaces: {
    '.': {
      // TODO figure out how to properly include jest config
      jest: false,
      ignoreDependencies: [
        // TODO remove these ignores when react 19 is released
        'react-19',
        'react-dom-19',

        // TODO figure out how to properly include jest config
        'jest-*',
      ],
      project: [
        'public/app/**',
        'scripts/**/*.ts*',
        '.github/**',

        // paths to ignore
        '!devenv/**',
        '!e2e-playwright/test-plugins/**',
        '!packages/**',
        '!pkg/**',
        ...externalisedDatasources.map((ds) => `!public/app/plugins/datasource/${ds}/**`),
      ],
      entry: ['public/app/app.ts', 'public/app/index.ts', 'public/app/plugins/**/module.{ts,tsx,js}'],
      webpack: {
        config: ['scripts/webpack/webpack.dev.ts', 'scripts/webpack/webpack.prod.ts'],
      },
      postcss: {
        config: 'scripts/webpack/postcss.config.js',
      },
    },
    [`public/app/plugins/datasource/{${externalisedDatasources.join(',')}}`]: {
      // TODO figure out how to properly include webpack config
      webpack: false,
      jest: true,
      entry: [...packageEntries, 'module.{ts,tsx,js}'],
      // these are provided by grafana-plugin-configs
      ignoreDependencies: ['@swc/jest'],
      ignoreUnresolved: ['identity-obj-proxy'],
    },
    'e2e-playwright/test-plugins/*': {
      // TODO figure out how to properly include webpack/jest configs
      webpack: false,
      entry: [...packageEntries, 'module.{ts,tsx,js}', 'plugins/*/module.{ts,tsx,js}'],
    },
    'packages/**': {
      entry: packageEntries,
      ignoreDependencies: packageIgnoreDeps,
      jest: true,
    },
    // `grafana-alerting` has stories that are included in `grafana-ui`'s storybook
    // this means:
    //   - we need to manually enable the storybook plugin since there's no storybook dep in package.json
    //   - its stories/mdx docs reference dependencies that are managed by `grafana-ui`
    // TODO `grafana-alerting` should probably have its own storybook (like `grafana-flamegraph`)
    'packages/grafana-alerting': {
      entry: packageEntries,
      ignoreDependencies: [
        ...packageIgnoreDeps,
        '@storybook/addon-docs',
        '@storybook/react-webpack5',
        '@storybook/react',
      ],
      storybook: true,
    },
    'packages/grafana-api-clients': {
      entry: [...packageEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/generate.ts'],
    },
    'packages/grafana-plugin-configs': {
      // TODO figure out how to properly include webpack/jest configs
      webpack: false,
      // this package contains shared dependencies that aren't immediately used by the package
      ignoreDependencies: ['.*'],
    },
  },
};

export default config;
