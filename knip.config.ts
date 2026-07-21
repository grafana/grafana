import type { KnipConfig } from 'knip';

const packageIgnoreDeps = [
  // These are used by the base rollup config located outside of the packages
  '@rollup/plugin-node-resolve',
  'rollup-plugin-esbuild',
  'rollup-plugin-node-externals',
];

const defaultEntries = ['i18next.config.ts'];

const externalisedDatasources = [
  'azuremonitor',
  'grafana-testdata-datasource',
  'graphite',
  'influxdb',
  'loki',
  'mysql',
];

const config: KnipConfig = {
  compilers: {
    mdx: true,
  },
  exclude: [
    // we don't often use enums, but when we do we usually include members we'll utilise in the future
    'enumMembers',
  ],
  rules: {
    // there are cases where duplicates are necessary e.g. React.lazy expects a default import
    duplicates: 'off',
  },
  ignore: [
    '**/*.gen.ts*',
    '**/*_gen.ts*',
    'public/app/features/alerting/unified/search/search.terms.js',
    'scripts/grafana-server/tmp/**',
    'devenv/**',
  ],
  ignoreBinaries: ['jq', 'make', 'shellcheck'],
  tags: ['-lintignore'],
  workspaces: {
    '.': {
      ignoreDependencies: [
        // TODO remove these ignores when react 19 is released
        'react-19',
        'react-dom-19',

        // used by yarn test:ci
        'jest-junit',

        // used by coverage script, see jest.config.codeowner.js
        'jest-monocart-coverage',

        // needed by github actions
        '@grafana/levitate',
        'wait-on',

        // used via `yarn <bin>` in scripts/validate-npm-packages.sh — knip doesn't detect yarn-invoked binaries
        '@arethetypeswrong/cli',
        'publint',
      ],
      project: [
        'public/app/**',
        'scripts/**',
        '.github/**',
        'e2e-playwright/**',

        // paths to ignore
        '!e2e-playwright/test-plugins/**',
        '!packages/**',
        '!pkg/**',
        '!scripts/grafana-server/tmp/**',
        ...externalisedDatasources.map((ds) => `!public/app/plugins/datasource/${ds}/**`),
      ],
      entry: [
        ...defaultEntries,
        'public/app/app.ts',
        'public/app/index.ts',
        'public/app/api/clients/**/index.ts',
        'public/app/extensions/index.ts',
        'public/app/extensions/api/clients/**/index.ts',
        'public/app/plugins/**/module.{ts,tsx,js}',
        'scripts/**/*.{t,j,mt,mj,cj}s*',
        '!scripts/grafana-server/tmp/**',

        // reporter for playwright
        'e2e-playwright/utils/axe-a11y/reporter.ts',

        // levitate
        '.github/workflows/scripts/levitate/*.js',

        // custom jest config for code coverage
        'jest.config.codeowner.js',
      ],
      webpack: {
        config: ['scripts/webpack/webpack.dev.ts', 'scripts/webpack/webpack.prod.ts'],
      },
      postcss: {
        config: 'scripts/webpack/postcss.config.js',
      },
      playwright: {
        config: [
          'e2e-playwright/playwright.config.ts',
          'e2e-playwright/extensions/enterprise/playwright-enterprise.config.ts',
          'e2e-playwright/extensions/oem/playwright-enterprise-oem.config.ts',
        ],
      },
    },
    [`public/app/plugins/datasource/{${externalisedDatasources.join(',')}}`]: {
      jest: true,
      entry: [...defaultEntries, 'module.{ts,tsx,js}'],
      // these are provided by grafana-plugin-configs
      ignoreDependencies: ['@swc/jest'],
      ignoreUnresolved: ['identity-obj-proxy'],
    },
    'e2e-playwright/test-plugins/*': {
      entry: [...defaultEntries, 'module.{ts,tsx,js}', 'plugins/*/module.{ts,tsx,js}'],
    },
    'packages/**': {
      entry: defaultEntries,
      ignoreDependencies: packageIgnoreDeps,
      jest: true,
    },
    // `grafana-alerting` has stories that are included in `grafana-ui`'s storybook
    // this means:
    //   - we need to manually enable the storybook plugin since there's no storybook dep in package.json
    //   - its stories/mdx docs reference dependencies that are managed by `grafana-ui`
    // TODO `grafana-alerting` should probably have its own storybook (like `grafana-flamegraph`)
    'packages/grafana-alerting': {
      entry: defaultEntries,
      ignoreDependencies: [
        ...packageIgnoreDeps,
        '@storybook/addon-docs',
        '@storybook/react-webpack5',
        '@storybook/react',
      ],
      storybook: true,
    },
    'packages/grafana-api-clients': {
      entry: [...defaultEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/generate.ts'],
    },
    'packages/grafana-plugin-configs': {
      // this package contains shared code that isn't immediately used by the package
      webpack: false,
      ignoreDependencies: ['.*'],
    },
  },
};

export default config;
