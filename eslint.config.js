// TODO: Migrate to Typescript.
// @ts-nocheck
const emotionPlugin = require('@emotion/eslint-plugin');
const restrictedGlobals = require('confusing-browser-globals');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const jestDomPlugin = require('eslint-plugin-jest-dom');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const lodashPlugin = require('eslint-plugin-lodash');
const barrelPlugin = require('eslint-plugin-no-barrel-files');
const reactPlugin = require('eslint-plugin-react');
const reactPreferFunctionComponentPlugin = require('eslint-plugin-react-prefer-function-component');
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const unicornPlugin = require('eslint-plugin-unicorn');

const grafanaConfig = require('@grafana/eslint-config/flat');
const grafanaPlugin = require('@grafana/eslint-plugin');
const grafanaI18nPlugin = require('@grafana/i18n/eslint-plugin');

const jsTsFiles = '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}';

const pluginsToTranslate = ['public/app/plugins/panel', 'public/app/plugins/datasource/azuremonitor'];

const commonTestIgnores = [
  '**/*.{test,spec}.{ts,tsx}',
  '**/__mocks__/**',
  '**/mocks/**/*.{ts,tsx}',
  '**/public/test/**',
  '**/{mocks,test-utils}.{ts,tsx}',
  '**/*.mock.{ts,tsx}',
  '**/{test-helpers,testHelpers}.{ts,tsx}',
  '**/{spec,test-helpers}/**/*.{ts,tsx}',
  'packages/grafana-test-utils/src/**/*.{ts,tsx}',
];

const generatedFiles = ['**/*.gen.ts', '**/*_gen.ts'];

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
    {
      group: ['react-router', 'react-router-dom'],
      message: 'Import from react-router-dom-v5-compat instead until the react-router v6 migration is complete.',
    },
  ],
  paths: [
    {
      name: 'react-redux',
      importNames: ['useDispatch', 'useSelector'],
      message: 'Please import from app/types/store instead.',
    },
    {
      name: 'react-use',
      importNames: ['useObservable'],
      message: 'react-use is being phased out. Import useObservable from @grafana/data/unstable instead.',
    },
    {
      name: 'react-use',
      importNames: ['useCopyToClipboard'],
      message: 'Please import copyTextToClipboard from @grafana/ui instead.',
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

// React 19 related TransitionGroup rules to prevent usage of findDomNode. Remove once React 19 is the default
const transitionNodeRefRestriction = {
  selector:
    "JSXElement[openingElement.name.name=/^(CSSTransition|Transition)$/]:not(:has(JSXAttribute[name.name='nodeRef']))",
  message:
    'CSSTransition components must have a nodeRef attribute to avoid findDOMNode usage which breaks in React 19. See https://reactcommunity.org/react-transition-group/transition#Transition-prop-nodeRef for more details.',
};

const gmaRuleListRoot = 'public/app/features/alerting/unified/gma-rule-list';

// Alerting modules, relative to unified/, that the GMA-only rule list may import. Everything here is
// infrastructure that stays after the legacy list is removed. Anything tied to the legacy rule or
// group model (rule-list/, components/rules/, MetaText, MoreButton, Provisioning, legacy rule hooks
// and APIs) is deliberately absent.
const gmaAllowedUnifiedModules = [
  'Analytics',
  'withPageErrorBoundary',
  'components/AlertingPageWrapper',
  'components/HoverCard',
  'components/assistant/AnalizeRuleButton',
  'components/rule-editor/useDashboardQuery',
  'components/rule-list/extensions/EnrichmentDrawerExtension',
  'components/saved-searches/SavedSearches',
  'components/saved-searches/savedSearchesSchema',
  'components/silences/SilenceGrafanaRuleDrawer',
  'hooks/abilities/abilityUtils',
  'hooks/abilities/otherAbilities',
  'hooks/abilities/rules/ruleAbilities.utils',
  'hooks/abilities/types',
  'hooks/useFolder',
  'hooks/useGenericSavedSearches',
  'hooks/useReturnTo',
  'hooks/useURLSearchParams',
  'state/AlertmanagerContext',
  'utils/datasource',
  'utils/k8s/*',
  'utils/labels',
  'utils/matchers',
  'utils/misc',
  'utils/navigation',
  'utils/url',
];

// Modules outside the alerting feature, relative to app/.
const gmaAllowedAppModules = [
  'api/clients/folder/v1beta1/utils',
  'api/clients/iam/v0alpha1',
  'core/app_events',
  'core/components/NestedFolderPicker/NestedFolderPicker',
  'core/components/Select/DashboardPicker',
  'core/constants',
  'core/copy/appNotification',
  'core/services/context_srv',
  'core/utils/kbn',
  'features/apiserver/types',
  'features/datasources/components/picker/DataSourceLogo',
  'features/datasources/components/picker/DataSourcePicker',
  'store/store',
  'types/accessControl',
  'types/store',
  'types/unified-alerting-dto',
];

const gmaAllowedTestUnifiedModules = ['mockApi', 'mocks', 'mocks/server/events', 'testSetup/datasources'];
const gmaAllowedTestAppModules = ['core/services/backend_srv', 'plugins/datasource/alertmanager/types'];

const gmaUnifiedAppPath = 'features/alerting/unified';

function modulesRegex(modules) {
  return modules.map((module) => module.replace(/[.+?^${}()|\\]/g, '\\$&').replace(/\/\*$/, '/[^/]+')).join('|');
}

// Imports of app/** and of relative paths that leave gma-rule-list/ must be on the allowlist; imports
// of packages and of files inside gma-rule-list/ are not restricted here. Regexes are used because
// gitignore-style negation cannot re-include a file under an excluded directory.
function gmaImportAllowlistPatterns({ tests }) {
  const unifiedModules = modulesRegex([...gmaAllowedUnifiedModules, ...(tests ? gmaAllowedTestUnifiedModules : [])]);
  const appModules = modulesRegex([...gmaAllowedAppModules, ...(tests ? gmaAllowedTestAppModules : [])]);
  // Only tests may use the shared test helpers in gma-rule-list/mocks.
  const ownFolders = modulesRegex([...gmaKindFolders, ...gmaCapabilityFolders, 'shared', ...(tests ? ['mocks'] : [])]);
  const message =
    'The GMA-only rule list may import only files inside gma-rule-list/, packages, and the shared alerting infrastructure on the allowlist in eslint.config.js. Do not reuse the legacy rule list, its components, rule hooks or models; build an equivalent under gma-rule-list/.';

  return [
    {
      regex: `^app/(?!(?:${gmaUnifiedAppPath}/(?:${unifiedModules})|${gmaUnifiedAppPath}/gma-rule-list/.+|${appModules})$)`,
      message,
    },
    // `(?!\.)` keeps the engine from backtracking into fewer `../` segments to dodge the lookahead.
    { regex: `^(?:\\.\\./)+(?!\\.)(?!(?:${ownFolders})(?:/|$)|(?:${unifiedModules})$)`, message },
  ];
}

const gmaRuleListBasePatterns = [
  {
    group: ['@grafana/alerting', '@grafana/alerting/*'],
    importNames: ['StateIcon'],
    message:
      'The GMA-only rule list draws its own status shapes, which the legacy list must not get; use RuleStatusIcon from gma-rule-list/rule-row instead.',
  },
  {
    group: ['@grafana/api-clients/rtkq/rules.alerting*'],
    importNamePattern: '^(?:use)?(?:Lazy)?CreateSearchRules',
    message:
      'The cross-kind /searchRules operation is not used by the GMA-only rule list; search each kind through its own transport module.',
  },
  {
    group: ['@grafana/api-clients/rtkq/rules.alerting*'],
    importNamePattern: '^use(?:Lazy)?List(?:Alert|Recording)RuleSearchV0Alpha1',
    message:
      'The per-kind /search operations are reserved for a later phase; search through alertRuleSearch.ts or recordingRuleSearch.ts.',
  },
  {
    group: ['@grafana/api-clients/rtkq/rules.alerting*'],
    importNamePattern: '^use(?:Lazy)?List(?:Alert|Recording)RuleSearchRules',
    message:
      'The generated searchAlertRules and searchRecordingRules operations are mutations that cache nothing and provide no tags; search through useAlertRuleSearch or useRecordingRuleSearch.',
  },
  {
    group: ['@grafana/api-clients/rtkq/folder*', '**/api/clients/folder*'],
    importNamePattern: '^use(?:Lazy)?ListFolderSearch',
    message:
      'The generated folder search operation is a mutation that caches nothing and provides no tags; use useFolderPages from folder-browsing.',
  },
];

// Each search endpoint is named in one place: the per-kind seams for rule search and
// folder-browsing/folderSearch.ts for folder search. Everywhere else must not name an endpoint,
// by URL or through the generated API's endpoint map.
const gmaSearchSeamMessage =
  'Search endpoints belong in the search seam modules (alertRuleSearch.ts, recordingRuleSearch.ts, folderSearch.ts).';
const gmaSearchEndpointRestrictions = [
  transitionNodeRefRestriction,
  {
    selector: 'Literal[value=/(search(Alert|Recording)Rules|(rules|folders).search)$/]',
    message: gmaSearchSeamMessage,
  },
  {
    selector: 'TemplateElement[value.raw=/(search(Alert|Recording)Rules|(rules|folders).search)$/]',
    message: gmaSearchSeamMessage,
  },
  {
    selector: 'MemberExpression[property.name=/^(createSearchRules|list(Alert|Recording)RuleSearch)/]',
    message: gmaSearchSeamMessage,
  },
];

const gmaKindFolders = ['alert-rules', 'recording-rules'];
const gmaOutsideImportsMessage =
  'Only the GMA-only rule list route pages and legacy-migration/legacyRedirects may be imported from outside gma-rule-list/.';
const gmaPublicEntryPoints = [
  'alert-rules/AlertRulesPage',
  'alert-rules/recently-deleted/AlertRulesDeletedPage',
  'recording-rules/RecordingRulesPage',
  'recording-rules/recently-deleted/RecordingRulesDeletedPage',
  'legacy-migration/legacyRedirects',
];
const gmaCapabilityFolders = [
  'rule-row',
  'folder-browsing',
  'rule-data',
  'rule-search',
  'token-search',
  'rule-actions',
  'recently-deleted',
  'saved-searches',
  'legacy-migration',
  'page-shell',
];

// A later config block's no-restricted-imports replaces an earlier one for the same files, so each
// block carries the base patterns plus only its own folder boundary. Tests get their own block because
// they may also import the alerting test helpers.
function gmaRuleListBlocks(name, globs, extraPatterns) {
  const blockFor = (suffix, files, ignores, tests) => ({
    name: `grafana/gma-rule-list-overrides-${name}${suffix}`,
    files,
    ignores,
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            ...gmaRuleListBasePatterns,
            ...gmaImportAllowlistPatterns({ tests }),
            // Tests may build a kind's request as a fixture, so the folder boundaries bind source files only.
            ...(tests ? [] : extraPatterns),
          ],
        }),
      ],
    },
  });
  const sources = globs.map((glob) => `${glob}/**/*.{ts,tsx,js,jsx}`);
  const tests = globs.map((glob) => `${glob}/**/*.test.{ts,tsx}`);
  return [blockFor('', sources, ['**/*.test.{ts,tsx}'], false), blockFor('-tests', tests, [], true)];
}

function gmaRuleListOverrides() {
  const siblingKindMessage = (other) => ({
    group: [`**/${other}`, `**/${other}/**`],
    message: `Kind folders must not depend on each other; move shared code into a capability folder or gma-rule-list/shared instead of importing ${other}.`,
  });
  const kindFoldersPattern = {
    group: gmaKindFolders.flatMap((folder) => [`**/${folder}`, `**/${folder}/**`]),
    message:
      'Capability folders are shared by both rule kinds and must not import from alert-rules or recording-rules.',
  };
  const allFolders = [...gmaKindFolders, ...gmaCapabilityFolders];
  const sharedPattern = {
    group: allFolders.flatMap((folder) => [`**/${folder}`, `**/${folder}/**`]),
    message: 'gma-rule-list/shared holds generic pieces and must not import from any other gma-rule-list folder.',
  };
  const folderGlobs = (folders) => folders.map((folder) => `${gmaRuleListRoot}/${folder}`);

  return [
    {
      name: 'grafana/gma-rule-list-overrides',
      files: [`${gmaRuleListRoot}/**/*.{ts,tsx,js,jsx}`],
      rules: {
        'no-restricted-syntax': ['error', ...gmaSearchEndpointRestrictions],
      },
    },
    {
      name: 'grafana/gma-rule-list-overrides-search-seams',
      files: [
        `${gmaRuleListRoot}/alert-rules/alertRuleSearch.ts`,
        `${gmaRuleListRoot}/recording-rules/recordingRuleSearch.ts`,
        `${gmaRuleListRoot}/folder-browsing/folderSearch.ts`,
      ],
      rules: { 'no-restricted-syntax': ['error', transitionNodeRefRestriction] },
    },
    // Tests and their mocks stand in for the server, so they name the endpoint URLs.
    {
      name: 'grafana/gma-rule-list-overrides-tests',
      files: [`${gmaRuleListRoot}/**/*.test.{ts,tsx}`, `${gmaRuleListRoot}/mocks/**/*.{ts,tsx}`],
      rules: { 'no-restricted-syntax': ['error', transitionNodeRefRestriction] },
    },
    ...gmaRuleListBlocks('alert-rules', folderGlobs(['alert-rules']), [siblingKindMessage('recording-rules')]),
    ...gmaRuleListBlocks('recording-rules', folderGlobs(['recording-rules']), [siblingKindMessage('alert-rules')]),
    ...gmaRuleListBlocks('capabilities', folderGlobs(gmaCapabilityFolders), [kindFoldersPattern]),
    ...gmaRuleListBlocks('shared', folderGlobs(['shared']), [sharedPattern]),
    // Everything else in the app reaches the list only through its route pages and the legacy URL redirects.
    {
      name: 'grafana/gma-rule-list-outside-imports',
      files: ['public/app/**/*.{ts,tsx,js,jsx}'],
      ignores: [`${gmaRuleListRoot}/**`, 'public/app/extensions/**/*'],
      rules: {
        // ESLint's no-restricted-imports does not see dynamic import(), which the route table uses.
        // esquery regexes cannot contain a slash, so `.` stands in for it.
        'no-restricted-syntax': [
          'error',
          transitionNodeRefRestriction,
          {
            selector: `ImportExpression[source.value=/gma-rule-list/]:not([source.value=/gma-rule-list.(${gmaPublicEntryPoints
              .join('|')
              .replaceAll('/', '.')})$/])`,
            message: gmaOutsideImportsMessage,
          },
        ],
        'no-restricted-imports': [
          'error',
          withBaseRestrictedImportsConfig({
            patterns: [
              {
                group: ['app/extensions', 'app/extensions/*'],
                message: 'Importing from app/extensions is not allowed',
              },
              {
                regex: `(?:^|/)gma-rule-list(?:/(?!(?:${gmaPublicEntryPoints.join('|')})$)|$)`,
                message: gmaOutsideImportsMessage,
              },
            ],
          }),
        ],
      },
    },
  ];
}

const datavizDefaultImportsRestrictions = [
  {
    group: ['@emotion/css'],
    importNames: ['cx'],
    message: 'Do not use "cx" from @emotion/css. Instead, use `clsx` and compose together only strings.',
  },
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
      ...generatedFiles,
      '**/build/',
      '**/compiled/',
      '**/dist/',
      'coverage/',
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
      'scripts/grafana-server/tmp-gma',
      'packages/grafana-ui/src/graveyard', // deprecated UI components slated for removal
      'public/build-swagger', // swagger build output
      'apps/plugins/plugin/src/generated/meta/v0alpha1',
      'apps/plugins/plugin/src/generated/plugin/v0alpha1',
      'packages/get-document/index.js',
      'packages/mapbox-jsonlint-lines-primitives/lib/jsonlint.js',
      'packages/mapbox-jsonlint-lines-primitives/lib/formatter.js',
    ],
  },
  ...grafanaConfig,
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
    files: [`**/${jsTsFiles}`],
    ignores: ['packages/grafana-ui/src/components/Forms/Legacy/**'],
    plugins: {
      '@emotion': emotionPlugin,
      lodash: lodashPlugin,
      jest: jestPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'no-barrel-files': barrelPlugin,
      '@grafana': grafanaPlugin,
      unicorn: unicornPlugin,
      'react-prefer-function-component': reactPreferFunctionComponentPlugin,
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
      '@grafana/zod-import-namespace': 'error',
      '@grafana/no-direct-date-fns': 'error',
      '@grafana/no-direct-create-monitoring-logger': 'error',
      '@grafana/no-get-data-source-srv': 'error',
      'react-prefer-function-component/react-prefer-function-component': ['error', { allowJsxUtilityClass: true }],
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
      'no-restricted-syntax': ['error', transitionNodeRefRestriction],

      // Use typescript's no-redeclare for compatibility with overrides
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': ['error'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      'unicorn/no-empty-file': 'error',
      'no-constant-condition': 'error',
      '@grafana/define-feature-events': 'error',
      '@grafana/no-plain-links': 'error',
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: 'use(Async)$',
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
    name: 'grafana/grafana-ui-no-test-utils',
    files: ['packages/grafana-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              group: ['@grafana/test-utils'],
              message: "'@grafana/test-utils' creates a circular dependency with '@grafana/ui'",
            },
          ],
        }),
      ],
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
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
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
    name: 'grafana/packages',
    files: ['packages/**/*.{ts,tsx}'],
    ignores: [],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-extraneous-dependencies': ['error', { includeInternal: true }],
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
    name: 'grafana/e2e-selectors-serializable',
    files: ['packages/grafana-e2e-selectors/src/selectors/**/*.ts'],
    plugins: {
      '@grafana': grafanaPlugin,
    },
    rules: {
      '@grafana/serializable-e2e-selectors': 'error',
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
  ...gmaRuleListOverrides(),
  {
    name: 'grafana/css-in-js-validation-unified',
    plugins: {
      '@grafana': grafanaPlugin,
    },
    files: ['public/app/features/alerting/unified/**/*.{ts,tsx}'],
    rules: {
      '@grafana/no-invalid-css-properties': 'error',
    },
  },
  {
    name: 'grafana/i18n-plural-defaults',
    plugins: {
      '@grafana/i18n': grafanaI18nPlugin,
    },
    files: ['**/*.{ts,tsx,js}'],
    rules: {
      '@grafana/i18n/t-plural-defaults': 'error',
      '@grafana/i18n/trans-plural-defaults': 'error',
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
      '@grafana/i18n/no-untranslated-strings': [
        'error',
        { calleesToIgnore: ['^css$', 'use[A-Z].*'], basePaths: ['public/app/features'] },
      ],
      '@grafana/i18n/no-translation-top-level': 'error',
    },
  },
  {
    name: 'grafana/tests',
    plugins: {
      'testing-library': testingLibraryPlugin,
      'jest-dom': jestDomPlugin,
      jest: jestPlugin,
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
      'public/app/plugins/datasource/grafana-testdata-datasource/**/*.{ts,tsx}',
      'public/app/plugins/datasource/graphite/**/*.{ts,tsx}',
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
    files: ['packages/grafana-ui/src/components/Table/TableNG/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            ...datavizDefaultImportsRestrictions,
            {
              group: ['@grafana/data'],
              importNames: ['getFieldDisplayName'],
              message:
                'Using the method inside Table can have performance implications which are unnecessary. Instead, use the local `getDisplayName` from the table utils.',
            },
          ],
        }),
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
            ...datavizDefaultImportsRestrictions,
            {
              group: ['@grafana/data'],
              importNames: ['getFieldDisplayName'],
              message:
                'Using the method inside Table can have performance implications which are unnecessary. Instead, use the local `getDisplayName` from the table utils.',
            },
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

  // other dataviz panels which should just get our default set of restrictions
  {
    files: ['public/app/plugins/panel/state-timeline/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [...datavizDefaultImportsRestrictions],
        }),
      ],
    },
  },

  // Old betterer rules config:
  {
    files: [`**/${jsTsFiles}`],
    ignores: [
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
      'packages/grafana-ui/src/components/Forms/Legacy/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@grafana/no-aria-label-selectors': 'error',
    },
  },
  {
    files: [`**/${jsTsFiles}`],
    ignores: [
      ...commonTestIgnores,
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
    ],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@grafana/no-direct-local-storage-access': 'error',
      '@grafana/require-no-margin': 'error',
      '@grafana/no-locale-compare': 'error',
      // eslint-disable-next-line @grafana/no-gf-form
      '@grafana/no-gf-form': 'error',
      '@grafana/no-config-apps': 'error',
      '@grafana/no-config-panels': 'error',
      '@grafana/no-config-datasources': 'error',
      '@grafana/no-config-feature-toggles': 'error',
    },
  },
  {
    files: [...commonTestIgnores],
    ignores: [
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
    ],
    rules: {
      '@grafana/no-config-apps': 'error',
      '@grafana/no-config-panels': 'error',
      '@grafana/no-config-datasources': 'error',
    },
    plugins: {
      '@grafana': grafanaPlugin,
    },
  },
  {
    files: [...enterpriseIgnores],
    rules: {
      '@grafana/no-config-apps': 'error',
      '@grafana/no-config-panels': 'error',
      '@grafana/no-config-datasources': 'error',
    },
  },
  {
    files: ['public/app/**/*.{ts,tsx}'],
    ignores: [
      ...commonTestIgnores,
      // FIXME: Remove once all enterprise issues are fixed -
      // we don't have a suppressions file/approach for enterprise code yet
      ...enterpriseIgnores,
      // Ignore decoupled plugin webpack configs
      'public/app/**/webpack.config.ts',
    ],
    rules: {
      'no-barrel-files/no-barrel-files': 'error',
    },
  },

  {
    // @grafana/i18n shouldn't import from our 'library' NPM packages
    name: 'grafana/packages-that-i18n-cant-import',
    files: ['packages/grafana-i18n/**/*.{ts,tsx}'],
    ignores: [],
    rules: {
      'no-restricted-imports': [
        'error',
        withBaseRestrictedImportsConfig({
          patterns: [
            {
              group: ['@grafana/*'],
              message: "'@grafana/* packages' should not be imported in @grafana/i18n",
            },
          ],
        }),
      ],
    },
  },

  // {
  //   name: 'grafana/plugin-external-import-paths',
  //   files: [
  //     'public/app/plugins/panel/histogram/**/*.{ts,tsx}',
  //   ],
  //   plugins: {
  //     '@grafana': grafanaPlugin,
  //   },
  //   rules: {
  //     '@grafana/no-plugin-external-import-paths': 'error',
  //   },
  // },
];
