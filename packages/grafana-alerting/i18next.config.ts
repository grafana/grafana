import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'],
  extract: {
    input: ['src/**/*.{tsx,ts}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-alerting',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
});
