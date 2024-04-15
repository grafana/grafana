module.exports = {
  defaultNamespace: 'grafana-enterprise',

  // Adds changes only to en-US when extracting keys, every other language is provided by Crowdin
  locales: ['en-US'],

  input: ['../../public/app/extensions/**/*.{tsx,ts}'],

  output: './public/app/extensions/locales/$LOCALE/$NAMESPACE.json',

  sort: true,

  createOldCatalogs: false,

  failOnWarnings: true,

  verbose: false,
};
