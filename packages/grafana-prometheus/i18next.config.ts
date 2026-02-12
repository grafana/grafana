import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    input: ['src/**/*.{tsx,ts}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-prometheus',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // eslint-disable-next-line no-restricted-syntax
    sort: (a, b) => a.key.localeCompare(b.key, 'en-US'),
  },
});
