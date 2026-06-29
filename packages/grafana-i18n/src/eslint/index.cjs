const noUntranslatedStrings = require('./no-untranslated-strings/no-untranslated-strings.cjs');
const noTranslationTopLevel = require('./no-translation-top-level/no-translation-top-level.cjs');
const tPluralDefaults = require('./t-plural-defaults/t-plural-defaults.cjs');
const transPluralDefaults = require('./trans-plural-defaults/trans-plural-defaults.cjs');

module.exports = {
  rules: {
    'no-untranslated-strings': noUntranslatedStrings,
    'no-translation-top-level': noTranslationTopLevel,
    't-plural-defaults': tPluralDefaults,
    'trans-plural-defaults': transPluralDefaults,
  },
};
