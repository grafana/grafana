import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { addResourceBundle, filterPluralKeys } from '@grafana/i18n/internal';

import { SystemJS } from '../loader/systemjs';
import { resolveModulePath } from '../loader/utils';

interface AddTranslationsToI18nOptions {
  resolvedLanguage: string;
  fallbackLanguage: string;
  pluginId: string;
  translations: Record<string, string>;
}

export async function addTranslationsToI18n({
  resolvedLanguage,
  fallbackLanguage,
  pluginId,
  translations,
}: AddTranslationsToI18nOptions): Promise<void> {
  const resolvedPath = translations[resolvedLanguage];
  const fallbackPath = translations[fallbackLanguage];
  const path = resolvedPath ?? fallbackPath;

  if (!path) {
    if (resolvedLanguage !== DEFAULT_LANGUAGE) {
      console.warn(`Could not find any translation for plugin ${pluginId}`, { resolvedLanguage, fallbackLanguage });
    }
    return;
  }

  try {
    const module = await SystemJS.import(resolveModulePath(path));
    if (!module.default) {
      if (resolvedLanguage !== DEFAULT_LANGUAGE) {
        console.warn(`Could not find default export for plugin ${pluginId}`, {
          resolvedLanguage,
          fallbackLanguage,
          path,
        });
      }
      return;
    }

    const language = resolvedPath ? resolvedLanguage : fallbackLanguage;
    // For the default language, only load plural keys since singular forms are already embedded in source code.
    const resources = resolvedLanguage === DEFAULT_LANGUAGE ? filterPluralKeys(module.default) : module.default;
    addResourceBundle(language, pluginId, resources);
  } catch (error) {
    if (resolvedLanguage !== DEFAULT_LANGUAGE) {
      console.warn(`Could not load translation for plugin ${pluginId}`, {
        resolvedLanguage,
        fallbackLanguage,
        error,
        path,
      });
    }
  }
}
