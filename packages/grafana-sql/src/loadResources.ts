import { ENGLISH_US, GERMAN_GERMANY, ResourceLoader, Resources } from '@grafana/i18n';

const resources: Record<string, () => Promise<{ default: Resources }>> = {
  [`${ENGLISH_US}`]: async () => await import('./locales/en-US/grafana-sql.json'),
  [`${GERMAN_GERMANY}`]: async () => await import('./locales/de-DE/grafana-sql.json'),
};

export const loadResources: ResourceLoader = async (resolvedLanguage: string) => {
  if (!resources[resolvedLanguage]) {
    console.warn(`No translation found for language: ${resolvedLanguage}`);
    return {};
  }

  const translation = await resources[resolvedLanguage]();
  return translation.default;
};
