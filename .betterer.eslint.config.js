// @ts-check
const emotionPlugin = require('@emotion/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const lodashPlugin = require('eslint-plugin-lodash');
const barrelPlugin = require('eslint-plugin-no-barrel-files');
const reactPlugin = require('eslint-plugin-react');
const testingLibraryPlugin = require('eslint-plugin-testing-library');

const grafanaConfig = require('@grafana/eslint-config/flat');
const grafanaPlugin = require('@grafana/eslint-plugin');

// Include the Grafana config and remove the rules,
// as we just want to pull in all of the necessary configuration but not run the rules
// (this should only be concerned with checking rules that we want to improve,
// so there's no need to try and run the rules that will be linted properly anyway)
const { rules, ...baseConfig } = grafanaConfig;

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  {
    name: 'grafana/betterer-ignores',
    ignores: [
      '.github',
      '.yarn',
      '**/.*',
      '**/*.gen.ts',
      '**/build/',
      '**/compiled/',
      '**/dist/',
      'data/',
      'deployment_tools_config.json',
      'devenv',
      'e2e/test-plugins',
      'e2e/tmp',
      'packages/grafana-ui/src/components/Icon/iconBundle.ts',
      'pkg',
      'playwright-report',
      'public/lib/monaco/',
      'public/locales/_build',
      'public/locales/**/*.js',
      'public/vendor/',
      'scripts/grafana-server/tmp',
      '!.betterer.eslint.config.js',
    ],
  },
  {
    name: 'react/jsx-runtime',
    // @ts-ignore - not sure why but flat config is typed as a maybe?
    ...reactPlugin.configs.flat['jsx-runtime'],
  },
  {
    files: ['**/*.{ts,tsx,js}'],
    ...baseConfig,
    plugins: {
      ...baseConfig.plugins,
      '@emotion': emotionPlugin,
      lodash: lodashPlugin,
      jest: jestPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'no-barrel-files': barrelPlugin,
      '@grafana': grafanaPlugin,
      'testing-library': testingLibraryPlugin,
    },
    linterOptions: {
      // This reports unused disable directives that we can clean up but
      // it also conflicts with the betterer eslint rules so disabled
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@grafana/ui*', '*/Layout/*'],
              importNames: ['Layout', 'HorizontalGroup', 'VerticalGroup'],
              message: 'Use Stack component instead.',
            },
            {
              group: ['@grafana/ui/src/*', '@grafana/runtime/src/*', '@grafana/data/src/*'],
              message: 'Import from the public export instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.{test,spec}.{ts,tsx}', '**/__mocks__/**', '**/public/test/**', '**/mocks.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    files: ['public/app/**/*.{ts,tsx}'],
    rules: {
      'no-barrel-files/no-barrel-files': 'error',
    },
  },
  {
    files: ['public/**/*.tsx', 'packages/grafana-ui/**/*.tsx'],
    ignores: ['public/app/plugins/**', '**/*.story.tsx', '**/*.{test,spec}.{ts,tsx}', '**/__mocks__/', 'public/test'],
    rules: {
      '@grafana/no-untranslated-strings': [
        'error',
        {
          forceFix: [
            // Add paths here that are happy to be auto fixed by this rule,
            // for example
            // 'public/app/features/alerting'
          ],
        },
      ],
      '@grafana/no-translation-top-level': 'error',
    },
  },
];
