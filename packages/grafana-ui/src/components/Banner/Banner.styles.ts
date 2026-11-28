import { type GrafanaTheme2 } from '@grafana/data';

import { type BannerSeverity } from './types';
import { type BannerActionColor } from './utils';

export type BannerThemeColor = 'primary' | 'secondary' | 'tertiary' | 'accent';

export interface BannerCustomColors {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

interface BannerColors extends BannerCustomColors {
  emphasisColor?: string;
  dismissIconColor?: string;
  actionColor: BannerActionColor;
}

type BannerColorOptions =
  | { severity: BannerSeverity; isProminent?: boolean }
  | { severity?: undefined; themeColor?: BannerThemeColor; customColors?: BannerCustomColors };

/**
 * The colors of a Banner, which it passes to AbstractBanner.
 *
 * - A severity uses its subtle colors from the theme, or the banner.prominent tokens when the banner is prominent.
 * - A neutral banner uses custom colors when they are passed. Otherwise it uses the banner.neutral tokens of its theme
 *   color with the visual refresh, and the theme color's transparent colors without it, as the other themes style
 *   banners. The tokens don't depend on the flag, which Grafana sets at runtime on every theme.
 */
export const getBannerColors = (theme: GrafanaTheme2, options: BannerColorOptions): BannerColors => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  if (options.severity) {
    const { severity } = options;
    const color = theme.colors[severity];

    if (options.isProminent) {
      const { background, iconBoxBackground, text, border } = theme.components.banner.prominent[severity];

      return {
        backgroundColor: background,
        borderColor: visualRefreshEnabled ? border : color.borderTransparent,
        iconColor: text,
        textColor: text,
        emphasisColor: iconBoxBackground,
        dismissIconColor: text,
        actionColor: { severity: undefined, customColor: text },
      };
    }

    return {
      backgroundColor: visualRefreshEnabled ? color.subtleBackground : color.transparent,
      borderColor: visualRefreshEnabled ? color.subtleBorder : color.borderTransparent,
      iconColor: color.text,
      textColor: visualRefreshEnabled ? color.textEmphasis : theme.colors.text.primary,
      actionColor: { severity, customColor: undefined },
    };
  }

  if (options.customColors) {
    return {
      ...options.customColors,
      actionColor: { severity: undefined, customColor: options.customColors.iconColor },
    };
  }

  const themeColor = options.themeColor ?? 'primary';

  if (visualRefreshEnabled) {
    const { background, border, icon, text } = theme.components.banner.neutral[themeColor];

    return {
      backgroundColor: background,
      borderColor: border,
      iconColor: icon,
      textColor: text,
      actionColor: { severity: undefined, customColor: icon },
    };
  }

  const color = theme.colors[themeColor];

  return {
    backgroundColor: color.transparent,
    borderColor: color.borderTransparent,
    iconColor: color.text,
    textColor: theme.colors.text.primary,
    actionColor: { severity: undefined, customColor: color.text },
  };
};
