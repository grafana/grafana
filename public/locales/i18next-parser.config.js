module.exports = {
  // Default namespace used in your i18next config
  defaultNamespace: 'grafana',

  locales: ['en-US', 'fr-FR', 'es-ES', "de-DE", "zh-Hans", 'pseudo-LOCALE'],

  output: './public/locales/$LOCALE/$NAMESPACE.json',

  pluralSeparator: '__',

  sort: true,

  createOldCatalogs: false,

  // Don't include default values for English, they'll remain in the source code
  skipDefaultValues: (locale) => locale !== 'en-US',
};
