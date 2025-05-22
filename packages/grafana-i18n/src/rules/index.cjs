const noUntranslatedStrings = require('./no-untranslated-strings/no-untranslated-strings.cjs');
const noTranslationTopLevel = require('./no-translation-top-level/no-translation-top-level.cjs');

module.exports = {
  rules: {
    'no-untranslated-strings': noUntranslatedStrings,
    'no-translation-top-level': noTranslationTopLevel,
  },
};
