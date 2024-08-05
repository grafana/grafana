import { BackendModule } from 'i18next';

import { LanguageDefinition } from './constants';

const getLanguagePartFromCode = (code: string) => code.split('-')[0].toLowerCase();

export const loadTranslations = (languages: LanguageDefinition[]): BackendModule => ({
  type: 'backend',
  init() {},
  async read(language, namespace, callback) {
    let localeDef = languages.find((v) => v.code === language);
    if (!localeDef) {
      localeDef = languages.find((v) => getLanguagePartFromCode(v.code) === getLanguagePartFromCode(language));
    }

    if (!localeDef) {
      return callback(new Error(`No message loader available for ${language}`), null);
    }

    const namespaceLoader = localeDef.loader[namespace];
    if (!namespaceLoader) {
      return callback(new Error(`No message loader available for ${language} with namespace ${namespace}`), null);
    }

    const messages = await namespaceLoader();
    callback(null, messages);
  },
});
