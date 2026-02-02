// BMC file
// Author - mahmedi
import { getBackendSrv } from '@grafana/runtime';

import { getFeatureStatus } from './featureFlagSrv';

export class LocalizationSrv {
  constructor() {}

  GetLocalesJson(language: string) {
    if (getFeatureStatus('bhd-localization')) {
      return getBackendSrv().get(`/api/localization?lang=${language}`);
    }
    return Promise.resolve({});
  }

  GetLocalesJsonByLangAndUID(resourceUID: string, language: string) {
    return getBackendSrv().get(`/api/localization/${resourceUID}?lang=${language}`);
  }

  SaveLocalesJsonByLang(resourceUID: string, language: string, localesJson: { name: string; desc?: string }) {
    return getBackendSrv().post(`/api/localization/${resourceUID}?lang=${language}`, { ...localesJson });
  }
}

let singletonInstance: LocalizationSrv;

export function setLocalizationSrv(instance: LocalizationSrv) {
  singletonInstance = instance;
}

export function getLocalizationSrv(): LocalizationSrv {
  if (!singletonInstance) {
    singletonInstance = new LocalizationSrv();
  }
  return singletonInstance;
}
