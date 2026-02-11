import { defineConfig } from 'i18next-cli';

const collator = new Intl.Collator('en-US', {
  sensitivity: 'variant',
  ignorePunctuation: false,
  numeric: false,
});

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    input: ['**/*.{tsx,ts}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: 'mssql',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // eslint-disable-next-line no-restricted-syntax
    sort: (a, b) => collator.compare(a.key, b.key),
  },
});
