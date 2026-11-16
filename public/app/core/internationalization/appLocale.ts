import { type GrafanaTheme2 } from '@grafana/data';
import { getI18nInstance } from '@grafana/i18n/internal';

export function applyDocumentLanguage(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = getI18nInstance().dir(language);
}

const persianFont = 'Vazirmatn, ';
const uiVariants = [
  'xxl',
  'xl',
  'lg',
  'md',
  'base',
  'sm',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body',
  'bodySmall',
] as const;

export function withLocaleTypography(theme: GrafanaTheme2, language?: string): GrafanaTheme2 {
  if (!language || !/^fa(?:-|$)/i.test(language) || theme.typography.fontFamily.startsWith(persianFont)) {
    return theme;
  }

  const fontFamily = persianFont + theme.typography.fontFamily;
  const typography = { ...theme.typography, fontFamily };
  for (const variant of uiVariants) {
    typography[variant] = {
      ...typography[variant],
      fontFamily: persianFont + typography[variant].fontFamily,
    };
  }

  return {
    ...theme,
    typography,
    v1: {
      ...theme.v1,
      typography: {
        ...theme.v1.typography,
        fontFamily: { ...theme.v1.typography.fontFamily, sansSerif: fontFamily },
      },
    },
  };
}
