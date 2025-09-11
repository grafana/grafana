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
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const unicornPlugin = require('eslint-plugin-unicorn');

const grafanaConfig = require('@grafana/eslint-config/flat');
const grafanaPlugin = require('@grafana/eslint-plugin');
const grafanaI18nPlugin = require('@grafana/i18n/eslint-plugin');

const pluginsToTranslate = [
  'public/app/plugins/panel',
  'public/app/plugins/datasource/azuremonitor',
  'public/app/plugins/datasource/mssql',
];

const commonTestIgnores = [
  '**/*.{test,spec}.{ts,tsx}',
  '**/__mocks__/**',
  '**/mocks/**/*.{ts,tsx}',
  '**/public/test/**',
  '**/mocks.{ts,tsx}',
  '**/spec/**/*.{ts,tsx}',
];

const enterpriseIgnores = ['public/app/extensions/**/*', 'e2e/extensions/**/*'];

// [FIXME] add comment about this applying everywhere
const baseImportConfig = {
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
      group: ['@grafana/ui*', '*/Layout/*'],
      importNames: ['Layout', 'HorizontalGroup', 'VerticalGroup'],
      message: 'Use Stack component instead.',
    },
    {
      regex: '\\.test$',
      message:
        'Do not import test files. If you require reuse of constants/mocks across files, create a separate file with no tests',
    },
    {
      group: ['@grafana/ui/src/*', '@grafana/runtime/src/*', '@grafana/data/src/*'],
      message: 'Import from the public export instead.',
    },
  ],
  paths: [
    {
      name: 'react-redux',
      importNames: ['useDispatch', 'useSelector'],
      message: 'Please import from app/types/store instead.',
    },
  ],
};

/**
 *
 * @param {{ patterns?: Array<object>, paths?: Array<object> }} config
 * @returns
 */
function withBaseRestrictedImportsConfig(config = {}) {
  const finalConfig = {
    patterns: [...baseImportConfig.patterns, ...(config?.patterns ?? [])],
    paths: [...baseImportConfig.paths, ...(config?.paths ?? [])],
  };
  return finalConfig;
}

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
      'packages/grafana-ui/src/graveyard', // deprecated UI components slated for removal
      'public/build-swagger', // swagger build output
    ],
  },
  ...grafanaConfig,
  {
    name: 'react/jsx-runtime-rules',
    rules: reactPlugin.configs.flat['jsx-runtime'].rules,
  },
  {
    name: 'grafana/defaults',
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
      'no-restricted-imports': ['error', baseImportConfig],
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
    },
  },

  {
    name: 'grafana/no-extensions-imports',
    files: ['public/**/*.{ts,tsx,js}'],
    ignores: ['public/app/extensions/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              group: ['app/extensions', 'app/extensions/*'],
              message: 'Importing from app/extensions is not allowed',
            },
          ],
        }),
      ],
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
    // No NPM package should import from @grafana/*/internal because it does not exist
    // outside of this repo - they're not published to NPM.
    name: 'grafana/packages-overrides',
    files: ['packages/**/*.{ts,tsx}'],
    ignores: [],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              group: ['@grafana/*/internal'],
              message: "'internal' exports are not available in NPM packages because they are not published to NPM",
            },
          ],
        }),
      ],
    },
  },

  {
    // @grafana/runtime shouldn't be imported from our 'library' NPM packages
    name: 'grafana/packages-that-cant-import-runtime',
    files: [
      'packages/grafana-ui/**/*.{ts,tsx}',
      'packages/grafana-data/**/*.{ts,tsx}',
      'packages/grafana-schema/**/*.{ts,tsx}',
      'packages/grafana-e2e-selectors/**/*.{ts,tsx}',
    ],
    ignores: [],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              // Duplicated because these rules override the previous grafana/packages-overrides
              group: ['@grafana/*/internal'],
              message: "'internal' exports are not available in NPM packages because they are not published to NPM",
            },
            {
              group: ['@grafana/runtime'],
              message: "'@grafana/runtime' should not be imported from library packages",
            },
          ],
        }),
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
      'public/app/plugins/datasource/graphite/**/*.{ts,tsx}',
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
    // custom rule for Table to avoid performance regressions
    files: ['packages/grafana-ui/src/components/Table/TableNG/Cells/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              group: ['**/themes/ThemeContext'],
              importNames: ['useStyles2', 'useTheme2'],
              message:
                'Do not use "useStyles2" or "useTheme2" in a cell directly. Instead, provide styles to cells via `getDefaultCellStyles` or `getCellSpecificStyles`.',
            },
          ],
        }),
      ],
    },
  },

  // Old betterer rules config:
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores:
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      enterpriseIgnores,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      ...commonTestIgnores,
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
    ],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
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
        {
          selector:
            "Property[key.name='a11y'][value.type='ObjectExpression'] Property[key.name='test'][value.value='off']",
          message: 'Skipping a11y tests is not allowed. Please fix the component or story instead.',
        },
      ],
    },
  },
  {
    files: ['public/app/**/*.{ts,tsx}'],
    ignores: [
      ...commonTestIgnores,
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
    ],
    rules: {
      'no-barrel-files/no-barrel-files': 'error',
    },
  },
];
