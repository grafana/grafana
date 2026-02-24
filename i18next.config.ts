import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'], // Only en-US is updated - Crowdin will PR with other languages
  extract: {
    ignore: [
      'public/lib/monaco/**/*',
      'public/app/extensions/**/*',
      'public/app/plugins/datasource/**/*',
      'packages/*/dist/**/*',
    ],
    input: ['public/**/*.{tsx,ts}', 'packages/grafana-ui/**/*.{tsx,ts}', 'packages/grafana-data/**/*.{tsx,ts}'],
    output: 'public/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
});
