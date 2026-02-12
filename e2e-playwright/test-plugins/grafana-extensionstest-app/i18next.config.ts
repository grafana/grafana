import { defineConfig } from 'i18next-cli';
import pluginJson from './plugin.json';

export default defineConfig({
  locales: pluginJson.languages,
  extract: {
    input: ['**/*.{tsx,ts}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: pluginJson.id,
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // eslint-disable-next-line no-restricted-syntax
    sort: (a, b) => a.key.localeCompare(b.key, 'en-US'),
  },
});
