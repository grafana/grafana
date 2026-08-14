import { defineConfig } from 'i18next-cli';

import baseConfig from '../../../i18next.config';

export default defineConfig({
  ...baseConfig,
  extract: {
    ...baseConfig.extract,
    defaultNS: 'grafana-enterprise',
    input: ['../../../public/app/extensions/**/*.{tsx,ts}'],
    output: '../../../public/app/extensions/locales/{{language}}/{{namespace}}.json',
  },
});
