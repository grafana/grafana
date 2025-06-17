import { LANGUAGES, ResourceLoader } from '@grafana/i18n';

const resources = LANGUAGES.reduce<Record<string, () => Promise<{ default: any }>>>((acc, lang) => {
  acc[lang.code] = async () => await import(`./locales/${lang.code}/grafana-prometheus.json`);
  return acc;
}, {});

export const loadResources: ResourceLoader = async (resolvedLanguage: number) => {
  const translation = await resources[resolvedLanguage]();
  return translation.default;
};
