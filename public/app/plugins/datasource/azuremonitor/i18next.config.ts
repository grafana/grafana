import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  extract: {
    input: ['**/*.{tsx,ts}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-azure-monitor-datasource',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
});
