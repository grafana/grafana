import { BackendModule } from 'i18next';

import { LANGUAGES } from './constants';

const getLanguagePartFromCode = (code: string) => code.split('-')[0].toLowerCase();

export const loadTranslations: BackendModule = {
  type: 'backend',
  init() {},
  async read(language, namespace, callback) {
    let localeDef = LANGUAGES.find((v) => v.code === language);
    if (!localeDef) {
      localeDef = LANGUAGES.find((v) => getLanguagePartFromCode(v.code) === getLanguagePartFromCode(language));
    }
    if (!localeDef) {
      return callback(new Error('No message loader available for ' + language), null);
    }
    const messages = await localeDef.loader();
    callback(null, messages);
  },
};
