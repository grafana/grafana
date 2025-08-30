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
const grafanaI18nPlugin = require('@grafana/i18n/eslint-plugin');

// Include the base Grafana configs and remove the rules,
// as we just want to pull in all of the necessary configuration but not run the rules
// (this should only be concerned with checking rules that we want to improve,
// so there's no need to try and run the rules that will be linted properly anyway)
const mappedBaseConfigs = grafanaConfig.map((/** @type {import('eslint').Linter.Config} */ config) => {
  const { rules, ...baseConfig } = config;
  return baseConfig;
});

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
      'e2e-playwright/test-plugins',
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
    name: 'react/jsx-runtime-rules',
    rules: reactPlugin.configs.flat['jsx-runtime'].rules,
  },
  ...mappedBaseConfigs,
  {
    files: ['**/*.{ts,tsx,js}'],
    plugins: {
      '@emotion': emotionPlugin,
      lodash: lodashPlugin,
      jest: jestPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'no-barrel-files': barrelPlugin,
      '@grafana': grafanaPlugin,
      'testing-library': testingLibraryPlugin,
      '@grafana/i18n': grafanaI18nPlugin,
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
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
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
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/__mocks__/**',
      '**/public/test/**',
      '**/mocks.{ts,tsx}',
      '**/mocks/**/*.{ts,tsx}',
      '**/spec/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/__mocks__/**',
      '**/public/test/**',
      '**/mocks.{ts,tsx}',
      '**/spec/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Identifier[name=localStorage]',
          message: 'Direct usage of localStorage is not allowed. import store from @grafana/data instead',
        },
        {
          selector: 'MemberExpression[object.name=localStorage]',
          message: 'Direct usage of localStorage is not allowed. import store from @grafana/data instead',
        },
        {
          selector:
            'Program:has(ImportDeclaration[source.value="@grafana/ui"] ImportSpecifier[imported.name="Card"]) JSXOpeningElement[name.name="Card"]:not(:has(JSXAttribute[name.name="noMargin"]))',
          message:
            'Add noMargin prop to Card components to remove built-in margins. Use layout components like Stack or Grid with the gap prop instead for consistent spacing.',
        },
        {
          selector:
            'Program:has(ImportDeclaration[source.value="@grafana/ui"] ImportSpecifier[imported.name="Field"]) JSXOpeningElement[name.name="Field"]:not(:has(JSXAttribute[name.name="noMargin"]))',
          message:
            'Add noMargin prop to Field components to remove built-in margins. Use layout components like Stack or Grid with the gap prop instead for consistent spacing.',
        },
        {
          selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="localeCompare"]',
          message:
            'Using localeCompare() can cause performance issues when sorting large datasets. Consider using Intl.Collator for better performance when sorting arrays, or add an eslint-disable comment if sorting a small, known dataset.',
        },
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: 'Literal[value=/gf-form/], TemplateElement[value.cooked=/gf-form/]',
          // eslint-disable-next-line no-restricted-syntax
          message: 'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.',
        },
      ],
    },
  },
  {
    files: ['public/app/**/*.{ts,tsx}'],
    rules: {
      'no-barrel-files/no-barrel-files': 'error',
    },
  },
  {
    // custom rule for Table to avoid performance regressions
    files: ['packages/grafana-ui/src/components/Table/TableNG/Cells/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/themes/ThemeContext'],
              importNames: ['useStyles2', 'useTheme2'],
              message:
                'Do not use "useStyles2" or "useTheme2" in a cell directly. Instead, provide styles to cells via `getDefaultCellStyles` or `getCellSpecificStyles`.',
            },
          ],
        },
      ],
    },
  },
];
