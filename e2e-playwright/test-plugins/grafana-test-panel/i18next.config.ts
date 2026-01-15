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
  },
});
