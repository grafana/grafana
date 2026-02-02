import { BackendModule } from 'i18next';

import { getLocalizationSrv } from 'app/features/dashboard/services/LocalizationSrv';

import { DEFAULT_LANGUAGE, LANGUAGES } from './constants';

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

    const namespaceLoader = localeDef.loader[namespace];
    if (!namespaceLoader) {
      return callback(new Error(`No message loader available for ${language} with namespace ${namespace}`), null);
    }

    // BMC code - modified below code to get localized folders and dashboards names and merge it with grafana.json values
    // const messages = await namespaceLoader();
    const messages = await Promise.all([
      namespaceLoader(),
      getLocalizationSrv()
        .GetLocalesJson(localeDef.code)
        .catch((err) => {
          console.log('Error while fetching locales json', err.statusText);
          return {};
        }),
    ]).then((response: any[]) => {
      const fR = { ...response[0] };
      const bmcDynamic = response[1] || {};
      if (bmcDynamic['*']) {
        try {
          const gL = localStorage.getItem('globalLocales');
          let newGL = { ...bmcDynamic['*'] };
          if (gL) {
            const parsedGL = JSON.parse(gL);
            if (language === DEFAULT_LANGUAGE) {
              Object.keys(parsedGL).map((k) => {
                if (parsedGL[k] && parsedGL[k] === '') {
                  parsedGL[k] = newGL[k];
                }
              });
              newGL = { ...newGL, ...parsedGL };
            } else {
              Object.keys(newGL).map((k) => {
                if (newGL[k] && newGL[k] === '') {
                  newGL[k] = parsedGL[k];
                }
              });
              newGL = { ...parsedGL, ...newGL };
            }
          }
          localStorage.setItem('globalLocales', JSON.stringify(newGL));
        } catch (e) {}
        delete bmcDynamic['*'];
      }
      return { ...fR, ...{ 'bmc-dynamic': bmcDynamic } };
    });
    // BMC code - end
    callback(null, messages);
  },
};
