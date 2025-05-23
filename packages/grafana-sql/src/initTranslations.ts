import { addResourceBundle, getResolvedLanguage } from '@grafana/i18n';

const translations: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  'en-US': async () => await import('./locales/en-US/grafana-sql.json'),
  'de-DE': async () => await import('./locales/de-DE/grafana-sql.json'),
};

export async function initTranslations(pluginId: string) {
  const language = getResolvedLanguage();

  const translation = await translations[language]();

  addResourceBundle(language, pluginId, translation.default as any);
}
