import { ResourceKey } from 'i18next';
export type LocaleFileLoader = () => Promise<ResourceKey>;

type LocaleExtensionExports = {
  LOCALE_EXTENSIONS: Record<string, LocaleFileLoader | undefined>;
  ENTERPRISE_I18N_NAMESPACE: 'string';
};

export const localeExtensionImports: Record<string, LocaleExtensionExports> = import.meta.glob(
  '../../app/extensions/locales/localeExtensions.ts',
  {
    eager: true,
  }
);
