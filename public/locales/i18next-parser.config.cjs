module.exports = {
  // Base config
  locales: ['en-US'], // Only en-US is updated - Crowdin will PR with other languages
  sort: true,
  createOldCatalogs: false,
  failOnWarnings: true,
  verbose: false,
  resetDefaultValueLocale: 'en-US', // Updates extracted values when they change in code

  // OSS-specific config
  defaultNamespace: 'grafana',
  input: ['../../public/**/*.{tsx,ts}', '!../../public/app/extensions/**/*', '../../packages/grafana-ui/**/*.{tsx,ts}'],
  output: './public/locales/$LOCALE/$NAMESPACE.json',
};
