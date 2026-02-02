module.exports = {
  // Base config - same for both OSS and Enterprise
  locales: ['en-US'], // Only en-US  is updated - Crowdin will PR with other languages
  sort: true,
  createOldCatalogs: false,
  failOnWarnings: true,
  verbose: true,
  resetDefaultValueLocale: 'en-US', // Updates extracted values when they change in code

  // OSS-specific config
  defaultNamespace: 'grafana',
  input: [
    '../../public/**/*.{tsx,ts}',
    '!../../public/app/extensions/**/*', // Don't extract from Enterprise
    '../../packages/grafana-ui/**/*.{tsx,ts}',
    '../../packages/grafana-data/**/*.{tsx,ts}',
  ],
  output: './public/locales/$LOCALE/$NAMESPACE.json',
  // BMC code - to ignore dynamic localization keys for dashbaords/folders title
  // this config is present in i18next-parser v9.x which is present in grafana 11.2.2. Should work after upgrade
  keepRemoved: [
    /bmc\-dynamic.*/,
    /bmc\.notification/,
  ]
};
