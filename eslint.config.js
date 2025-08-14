// @ts-check
const emotionPlugin = require('@emotion/eslint-plugin');
const restrictedGlobals = require('confusing-browser-globals');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const jestDomPlugin = require('eslint-plugin-jest-dom');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const lodashPlugin = require('eslint-plugin-lodash');
const barrelPlugin = require('eslint-plugin-no-barrel-files');
const reactPlugin = require('eslint-plugin-react');
// FIXME: Remove once eslint-config-grafana is updated to include correct plugin
const hooksPlugin = require('eslint-plugin-react-hooks');
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const unicornPlugin = require('eslint-plugin-unicorn');

const grafanaConfig = require('@grafana/eslint-config/flat');
const grafanaPlugin = require('@grafana/eslint-plugin');
const grafanaI18nPlugin = require('@grafana/i18n/eslint-plugin');

const bettererConfig = require('./.betterer.eslint.config');
const getEnvConfig = require('./scripts/webpack/env-util');

const envConfig = getEnvConfig();
const enableBettererRules = envConfig.frontend_dev_betterer_eslint_rules;
const pluginsToTranslate = [
  'public/app/plugins/panel',
  'public/app/plugins/datasource/azuremonitor',
  'public/app/plugins/datasource/mssql',
];

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  {
    name: 'grafana/ignores',
    ignores: [
      '.github',
      '.yarn',
      '**/.*', // dotfiles aren't ignored by default in FlatConfig
      '**/*.gen.ts',
      '**/build/',
      '**/compiled/',
      '**/dist/',
      'data/',
      'deployment_tools_config.json',
      'devenv',
      'e2e-playwright/test-plugins',
      'e2e/tmp',
      'packages/grafana-ui/src/components/Icon/iconBundle.ts',
      'pkg',
      'playwright-report',
      'public/lib/monaco/', // this path is no longer required but local dev environments may still have it
      'public/locales/_build',
      'public/locales/**/*.js',
      'public/vendor/',
      'scripts/grafana-server/tmp',
      '!.betterer.eslint.config.js',
      'packages/grafana-ui/src/graveyard', // deprecated UI components slated for removal
      'public/build-swagger', // swagger build output
    ],
  },
  // FIXME: Remove once eslint-config-grafana is updated to include correct plugin
  {
    name: 'react-hooks-plugin',
    plugins: {
      'react-hooks': hooksPlugin,
    },
  },
  // Conditionally run the betterer rules if enabled in dev's config
  // ...(enableBettererRules ? bettererConfig : []),
  // FIXME: Remove filtering once eslint-config-grafana is updated to include correct plugin
  ...grafanaConfig.filter(Boolean),
  {
    name: 'react/jsx-runtime-rules',
    rules: reactPlugin.configs.flat['jsx-runtime'].rules,
  },
  {
    name: 'grafana/defaults',
    linterOptions: {
      // This reports unused disable directives that we can clean up but
      // it also conflicts with the betterer eslint rules so disabled
      reportUnusedDisableDirectives: false,
    },
    files: ['**/*.{ts,tsx,js}'],
    plugins: {
      '@emotion': emotionPlugin,
      lodash: lodashPlugin,
      jest: jestPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'no-barrel-files': barrelPlugin,
      '@grafana': grafanaPlugin,
      unicorn: unicornPlugin,
    },

    settings: {
      'import/internal-regex': '^(app/)|(@grafana)',
      'import/external-module-folders': ['node_modules', '.yarn'],
      // Silences a warning when linting enterprise code
      react: {
        version: 'detect',
      },
    },

    rules: {
      'no-duplicate-case': 'error',
      '@grafana/no-border-radius-literal': 'error',
      '@grafana/no-unreduced-motion': 'error',
      '@grafana/no-restricted-img-srcs': 'error',
      'react/prop-types': 'off',
      // need to ignore emotion's `css` prop, see https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md#rule-options
      'react/no-unknown-property': ['error', { ignore: ['css'] }],
      '@emotion/jsx-import': 'error',
      '@emotion/syntax-preference': [2, 'object'],
      'lodash/import-scope': [2, 'member'],
      'jest/no-focused-tests': 'error',
      'import/order': [
        'error',
        {
          pathGroups: [
            {
              pattern: 'img/**',
              group: 'internal',
            },
          ],
          groups: [['builtin', 'external'], 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-i18next', 'i18next'],
              importNames: ['t'],
              message: 'Please import from @grafana/i18n instead',
            },
            {
              group: ['react-i18next'],
              importNames: ['Trans'],
              message: 'Please import from @grafana/i18n instead',
            },
            {
              regex: '\\.test$',
              message:
                'Do not import test files. If you require reuse of constants/mocks across files, create a separate file with no tests',
            },
          ],
          paths: [
            {
              name: 'react-redux',
              importNames: ['useDispatch', 'useSelector'],
              message: 'Please import from app/types instead.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error'].concat(restrictedGlobals),

      // Use typescript's no-redeclare for compatibility with overrides
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': ['error'],
      'unicorn/no-empty-file': 'error',
      'no-constant-condition': 'error',
      'no-restricted-syntax': [
        'error',
        {
          // value regex is to filter out whitespace-only text nodes (e.g. new lines and spaces in the JSX)
          selector: "JSXElement[openingElement.name.name='a'] > JSXText[value!=/^\\s*$/]",
          message: 'No bare anchor nodes containing only text. Use `TextLink` instead.',
        },
      ],
      // FIXME: Fix these in follow up PR
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    name: 'grafana/uplot-overrides',
    files: ['packages/grafana-ui/src/components/uPlot/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    name: 'grafana/theme-demo-overrides',
    files: ['packages/grafana-ui/src/components/ThemeDemos/**/*.{ts,tsx}'],
    rules: {
      '@emotion/jsx-import': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    name: 'grafana/story-rules',
    files: ['packages/grafana-ui/src/**/*.story.tsx'],
    rules: {
      '@grafana/consistent-story-titles': 'error',
    },
  },
  {
    name: 'grafana/public-dashboards-overrides',
    files: ['public/dashboards/scripted*.js'],
    rules: {
      'no-redeclare': 'error',
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
  {
    name: 'grafana/jsx-a11y-overrides',
    files: ['**/*.tsx'],
    ignores: ['**/*.{spec,test}.tsx'],
    rules: {
      ...jsxA11yPlugin.configs.recommended.rules,
      'jsx-a11y/no-autofocus': [
        'error',
        {
          ignoreNonDOM: true,
        },
      ],
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          controlComponents: ['NumberInput'],
          depth: 2,
        },
      ],
    },
  },
  {
    name: 'grafana/data-overrides',
    files: ['packages/grafana-data/**/*.{ts,tsx}'],
    ignores: ['packages/grafana-data/src/**/*.{spec,test}.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@grafana/runtime', '@grafana/ui', '@grafana/data'],
        },
      ],
    },
  },
  {
    name: 'grafana/ui-overrides',
    files: ['packages/grafana-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@grafana/runtime', '@grafana/data/*', '@grafana/ui', '@grafana/e2e-selectors/*'],
          paths: [
            {
              name: 'react-i18next',
              importNames: ['Trans', 't'],
              message: 'Please import from grafana-ui/src/utils/i18n instead',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'grafana/schema-overrides',
    files: ['packages/grafana-schema/**/*.{ts,tsx}'],
    ignores: ['packages/grafana-schema/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@grafana/*'],
        },
      ],
    },
  },
  {
    name: 'grafana/runtime-overrides',
    files: ['packages/grafana-runtime/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@grafana/runtime', '@grafana/data/*', '@grafana/ui/*', '@grafana/e2e/*'],
        },
      ],
    },
  },
  {
    name: 'grafana/flamegraph-overrides',
    files: ['packages/grafana-flamegraph/**/*.{ts,tsx}'],
    ignores: ['packages/grafana-flamegraph/**/*.{test,story}.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@grafana/runtime', '@grafana/e2e', '@grafana/e2e-selectors/*'],
        },
      ],
    },
  },
  {
    name: 'grafana/alerting-overrides',
    plugins: {
      unicorn: unicornPlugin,
      react: reactPlugin,
      '@grafana': grafanaPlugin,
    },
    files: ['public/app/features/alerting/**/*.{ts,tsx,js,jsx}', 'packages/grafana-alerting/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      'dot-notation': 'error',
      'prefer-const': 'error',
      'react/no-unused-prop-types': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'unicorn/no-unused-properties': 'error',
      'no-nested-ternary': 'error',
    },
  },
  {
    // Sections of codebase that have all translation markup issues fixed
    name: 'grafana/i18n-overrides',
    plugins: {
      '@grafana': grafanaPlugin,
      '@grafana/i18n': grafanaI18nPlugin,
    },
    files: [
      'public/app/!(plugins)/**/*.{ts,tsx,js,jsx}',
      'packages/grafana-ui/**/*.{ts,tsx,js,jsx}',
      'packages/grafana-data/**/*.{ts,tsx,js,jsx}',
      'packages/grafana-sql/**/*.{ts,tsx,js,jsx}',
      'packages/grafana-prometheus/**/*.{ts,tsx,js,jsx}',
      ...pluginsToTranslate.map((plugin) => `${plugin}/**/*.{ts,tsx,js,jsx}`),
    ],
    ignores: [
      'public/test/**',
      '**/*.{test,spec,story}.{ts,tsx}',
      '**/{tests,__mocks__,__tests__,fixtures,spec,mocks}/**',
      '**/{test-utils,testHelpers,mocks}.{ts,tsx}',
      '**/mock*.{ts,tsx}',
    ],
    rules: {
      '@grafana/i18n/no-untranslated-strings': ['error', { calleesToIgnore: ['^css$', 'use[A-Z].*'] }],
      '@grafana/i18n/no-translation-top-level': 'error',
    },
  },
  {
    name: 'grafana/tests',
    plugins: {
      'testing-library': testingLibraryPlugin,
      'jest-dom': jestDomPlugin,
    },
    files: [
      'public/app/features/alerting/**/__tests__/**/*.[jt]s?(x)',
      'public/app/features/alerting/**/?(*.)+(spec|test).[jt]s?(x)',
      'packages/{grafana-ui,grafana-alerting}/**/*.{spec,test}.{ts,tsx}',
    ],
    rules: {
      ...testingLibraryPlugin.configs['flat/react'].rules,
      ...jestDomPlugin.configs['flat/recommended'].rules,
      'testing-library/prefer-user-event': 'error',
      'jest/expect-expect': ['error', { assertFunctionNames: ['expect*', 'assert*', 'reducerTester'] }],
    },
  },
  {
    name: 'grafana/test-overrides-to-fix',
    plugins: {
      'testing-library': testingLibraryPlugin,
    },
    files: ['packages/grafana-ui/**/*.{spec,test}.{ts,tsx}'],
    rules: {
      // grafana-ui has lots of violations of direct node access and container methods, so disabling for now
      'testing-library/no-node-access': 'off',
      'testing-library/no-container': 'off',
    },
  },
  {
    name: 'grafana/test-disables',
    files: ['**/*.{spec,test}.{ts,tsx}'],
    rules: {
      'react/display-name': 'off',
      'react/no-children-prop': 'off',
    },
  },
  {
    name: 'grafana/explore-traceview-overrides',
    files: ['public/app/features/explore/TraceView/components/demo/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    name: 'grafana/decoupled-plugins-overrides',
    files: [
      'public/app/plugins/datasource/azuremonitor/**/*.{ts,tsx}',
      'public/app/plugins/datasource/cloud-monitoring/**/*.{ts,tsx}',
      'public/app/plugins/datasource/cloudwatch/**/*.{ts,tsx}',
      'public/app/plugins/datasource/elasticsearch/**/*.{ts,tsx}',
      'public/app/plugins/datasource/elasticsearch/**/*.{ts,tsx}',
      'public/app/plugins/datasource/grafana-postgresql-datasource/**/*.{ts,tsx}',
      'public/app/plugins/datasource/grafana-pyroscope-datasource/**/*.{ts,tsx}',
      'public/app/plugins/datasource/grafana-testdata-datasource/**/*.{ts,tsx}',
      'public/app/plugins/datasource/jaeger/**/*.{ts,tsx}',
      'public/app/plugins/datasource/loki/**/*.{ts,tsx}',
      'public/app/plugins/datasource/loki/**/*.{ts,tsx}',
      'public/app/plugins/datasource/mysql/**/*.{ts,tsx}',
      'public/app/plugins/datasource/parca/**/*.{ts,tsx}',
      'public/app/plugins/datasource/tempo/**/*.{ts,tsx}',
      'public/app/plugins/datasource/zipkin/**/*.{ts,tsx}',
    ],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.ts', '.tsx'],
        },
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './public/app/plugins',
              from: './public',
              except: ['./app/plugins'],
              message: 'Core plugins are not allowed to depend on Grafana core packages',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'grafana/no-extensions-imports',
    files: ['**/*.{ts,tsx,js}'],
    ignores: ['public/app/extensions/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['app/extensions', 'app/extensions/*'],
              message: 'Importing from app/extensions is not allowed',
            },
          ],
        },
      ],
    },
  },
];
