import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    input: ['src/**/*.{tsx,ts}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-sql',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
});
