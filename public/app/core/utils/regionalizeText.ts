const TRANSLATIONS_MAP: Record<string, Record<string, string>> = {
  'en-US': {
    ising: 'izing',
  },
  default: {
    izing: 'ising',
  },
};

export function regionalizeText(input: string): string {
  const userLanguage = navigator.language;
  const language = userLanguage === 'en-US' ? 'en-US' : 'default';
  const translationsMap = TRANSLATIONS_MAP[language];

  // look through translation for user language,
  // return modified string if match found.
  for (let preTranslation in translationsMap) {
    if (input.endsWith(preTranslation)) {
      let baseIdx = input.length - preTranslation.length;
      let postTranslation = translationsMap[preTranslation];
      return input.substring(0, baseIdx) + postTranslation;
    }
  }

  // if no translation found, simply return original input.
  return input;
}
