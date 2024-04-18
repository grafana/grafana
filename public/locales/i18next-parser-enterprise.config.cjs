const baseConfig = require('./i18next-parser.config.cjs');

module.exports = {
  ...baseConfig,
  defaultNamespace: 'grafana-enterprise',
  input: ['../../public/app/extensions/**/*.{tsx,ts}'],
  output: './public/app/extensions/locales/$LOCALE/$NAMESPACE.json',
};
