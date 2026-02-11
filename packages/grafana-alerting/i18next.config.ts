import { defineConfig } from 'i18next-cli';

const collator = new Intl.Collator('en-US', {
  sensitivity: 'variant',
  ignorePunctuation: false,
  numeric: false,
});

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    input: ['src/**/*.{tsx,ts}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-alerting',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // eslint-disable-next-line no-restricted-syntax
    sort: (a, b) => collator.compare(a.key, b.key),
  },
});
