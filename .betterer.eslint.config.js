// @ts-check
/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
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
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.{test,spec}.{ts,tsx}', '**/__mocks__/**', '**/public/test/**'],
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
      '@grafana/no-untranslated-strings': 'error',
    },
  },
];
