import { defineConfig } from 'i18next-cli';
import pluginJson from './plugin.json';

const collator = new Intl.Collator('en-US', {
  sensitivity: 'variant',
  ignorePunctuation: false,
  numeric: false,
});

export default defineConfig({
  locales: pluginJson.languages,
  extract: {
    input: ['**/*.{tsx,ts}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: pluginJson.id,
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    // eslint-disable-next-line no-restricted-syntax
    sort: (a, b) => collator.compare(a.key, b.key),
  },
});
