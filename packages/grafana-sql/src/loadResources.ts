import { LANGUAGES, ResourceLoader, Resources } from '@grafana/i18n';

const resources = LANGUAGES.reduce<Record<string, () => Promise<{ default: Resources }>>>((acc, lang) => {
  acc[lang.code] = async () => await import(`./locales/${lang.code}/grafana-sql.json`);
  return acc;
}, {});

export const loadResources: ResourceLoader = async (resolvedLanguage: string) => {
  const translation = await resources[resolvedLanguage]();
  return translation.default;
};
