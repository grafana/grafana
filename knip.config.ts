import type { KnipConfig } from 'knip';

const packageIgnoreDeps = [
  // These are used by the base rollup config located outside of the packages
  '@rollup/plugin-node-resolve',
  'rollup-plugin-esbuild',
  'rollup-plugin-node-externals',
];

const defaultEntries = ['i18next.config.ts'];

// production mode (`knip --production`) only includes entry/project patterns suffixed with `!`,
// and `!pattern!` excludes test/story/tooling helpers that are only reachable from non-production entries
const nonProductionFiles = [
  '!**/{__fixtures__,__mocks__,__smoke__,__test-utils__,demo,fixtures,mocks,scripts,spec,storybook,test,test-fixtures,test-utils,testCases,testData,testdata,testfiles,testing,tests,testSetup,ThemeDemos}/**!',
  '!**/*.{fixture,fixtures,scenario,smoke,story,test.resources}.{ts,tsx}!',
  '!**/*{mock,Mock,StoryHelper,storyUtils,testData,testHelpers,TestUtils,testUtils,testsUtils,test-utils}*.{js,ts,tsx}!',
  '!**/jest-setup.js!',
  '!**/*.mdx!',
  '!**/*Fixture.ts!',

  // test-only helpers that don't follow the naming conventions above
  '!public/app/features/alerting/unified/utils/search.ts!',
  '!public/app/features/variables/state/helpers.ts!',
  // synchronous registry used by tests to check parity with lazyRegistry
  '!public/app/features/dashboard-scene/mutation-api/{index,commands/registry}.ts!',
];

const defaultProject = ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts,mdx}!', ...nonProductionFiles];

const externalisedDatasources = ['azuremonitor', 'cloudwatch', 'grafana-testdata-datasource', 'graphite'];

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

    // vendored temporarily
    'packages/grafana-data/src/datetime/easytz.js',
    'packages/grafana-data/src/datetime/luxon_moment_compat/luxon.js',
    // TODO: Remove once Rspack replaces Webpack.
    'public/app/core/utils/CorsWorker.rspack.ts',
    'public/app/core/utils/CorsSharedWorker.rspack.ts',
  ],
  // nx and webpack are devDependencies run by production scripts (e.g. `start`), so --production flags them as unlisted
  ignoreBinaries: ['jq', 'make', 'nx', 'shellcheck', 'webpack'],
  tags: ['-lintignore'],
  workspaces: {
    '.': {
      ignoreDependencies: [
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

        // not imported directly, but the pin keeps react-router@5 hoisted to the top level so
        // @types/react-router-dom resolves v5 types (otherwise react-router@6 from
        // react-router-dom-v5-compat wins the hoist). Remove both when core swaps to react-router 6.
        'react-router',
        '@types/react-router',
      ],
      project: [
        'public/app/**!',
        'public/swagger/**!',
        ...nonProductionFiles,
        'scripts/**',
        '.github/**',
        'e2e-playwright/**',

        // paths to ignore
        '!e2e-playwright/test-plugins/**',
        '!packages/**',
        'packages/rollup.config.parts.ts',
        '!pkg/**',
        '!scripts/grafana-server/tmp/**',
        ...externalisedDatasources.map((ds) => `!public/app/plugins/datasource/${ds}/**`),
      ],
      entry: [
        ...defaultEntries,
        'packages/rollup.config.parts.ts',
        'public/app/app.ts!',
        'public/app/index.ts!',
        'public/swagger/index.tsx!',
        'public/app/api/clients/**/index.ts!',
        'public/app/extensions/index.ts!',
        'public/app/extensions/api/clients/**/index.ts!',
        'public/app/plugins/**/module.{ts,tsx,js}!',
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
      rspack: {
        config: ['scripts/rspack/rspack.dev.ts', 'scripts/rspack/rspack.prod.ts'],
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
      entry: [...defaultEntries, 'module.{ts,tsx,js}!'],
      project: defaultProject,
      // these are provided by grafana-plugin-configs
      ignoreDependencies: ['@swc/jest'],
      ignoreUnresolved: ['identity-obj-proxy'],
    },
    'e2e-playwright/test-plugins/*': {
      entry: [...defaultEntries, 'module.{ts,tsx,js}!', 'plugins/*/module.{ts,tsx,js}!'],
      project: defaultProject,
    },
    'packages/**': {
      entry: defaultEntries,
      project: defaultProject,
      ignoreDependencies: packageIgnoreDeps,
      jest: true,
    },
    // `grafana-alerting` has stories that are included in `grafana-ui`'s storybook,
    // so we need to manually enable the storybook plugin since there's no storybook dep in package.json
    // TODO `grafana-alerting` should probably have its own storybook (like `grafana-flamegraph`)
    'packages/grafana-alerting': {
      entry: defaultEntries,
      project: defaultProject,
      ignoreDependencies: packageIgnoreDeps,
      storybook: true,
    },
    'packages/grafana-api-clients': {
      entry: [...defaultEntries, 'src/scripts/generate-rtk-apis.ts', 'src/generator/generate.ts'],
      project: [...defaultProject, '!src/generator/**!'],
    },
    'packages/grafana-sql': {
      // resolved via the `moment$` webpack alias in grafana-plugin-configs, which knip can't follow
      entry: [...defaultEntries, 'src/utils/raqbMomentCompat.ts!'],
      project: defaultProject,
      ignoreDependencies: packageIgnoreDeps,
      jest: true,
    },
    'packages/grafana-plugin-configs': {
      // this package contains shared code that isn't immediately used by the package
      webpack: false,
      // dev tooling only, so nothing is part of production
      project: ['**/*.{js,ts}'],
      ignoreDependencies: ['.*'],
    },
    'packages/grafana-plugin-compat': {
      project: defaultProject,
      ignoreDependencies: packageIgnoreDeps,
    },
  },
};

export default config;
