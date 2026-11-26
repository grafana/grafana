import { type GrafanaTheme2 } from '@grafana/data';

export type VisualRefreshSetting = 'auto' | 'on' | 'off';

const visualRefreshThemeNames = ['Visual Refresh (Light)', 'Visual Refresh (Dark)'];

/**
 * Sets `theme.flags.visualDesignRefresh` from the Visual refresh toolbar setting. With the
 * `grafana.visualDesignRefresh` feature flag on, Grafana sets the flag on every theme, including the extra ones such as
 * the color-blind themes, so `on` previews a theme as it renders there. `auto` turns the flag on only for the visual
 * refresh themes.
 */
export const applyVisualRefreshSetting = (theme: GrafanaTheme2, setting: VisualRefreshSetting = 'auto') => {
  theme.flags.visualDesignRefresh =
    setting === 'auto' ? visualRefreshThemeNames.includes(theme.name) : setting === 'on';

  return theme;
};
