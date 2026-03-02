import { defineConfig } from 'i18next-cli';

import { duplicateKeyCheckPlugin } from './packages/grafana-i18n/src/plugins/duplicate-key-check';

export default defineConfig({
  locales: ['en-US'], // Only en-US is updated - Crowdin will PR with other languages
  extract: {
    ignore: [
      'public/lib/monaco/**/*',
      'public/app/extensions/**/*',
      'public/app/plugins/datasource/**/*',
      'packages/*/dist/**/*',
      'packages/grafana-i18n/src/plugins/__tests__/fixtures/**/*',
    ],
    input: ['public/**/*.{tsx,ts}', 'packages/grafana-ui/**/*.{tsx,ts}', 'packages/grafana-data/**/*.{tsx,ts}'],
    output: 'public/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana',
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
  plugins: [duplicateKeyCheckPlugin({ failOnConflict: true })],
});
