import { BackendModule } from 'i18next';

import { DEFAULT_LANGUAGE } from '@grafana/i18n';

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
      return callback(new Error(`No message loader available for ${language}`), null);
    }

    // don't load messages for DEFAULT_LANGUAGE as they are already embedded in the source code
    if (localeDef.code === DEFAULT_LANGUAGE) {
      return callback(null, {});
    }

    const namespaceLoader = localeDef.loader[namespace];
    if (!namespaceLoader) {
      return callback(new Error(`No message loader available for ${language} with namespace ${namespace}`), null);
    }

    const messages = await namespaceLoader();
    callback(null, messages);
  },
};
