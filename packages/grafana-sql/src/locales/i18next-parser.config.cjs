module.exports = {
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  sort: true,
  createOldCatalogs: false,
  failOnWarnings: true,
  verbose: false,
  resetDefaultValueLocale: 'en-US', // Updates extracted values when they change in code

  defaultNamespace: 'grafana-sql',
  input: ['../**/*.{tsx,ts}'],
  output: './src/locales/$LOCALE/$NAMESPACE.json',
};
