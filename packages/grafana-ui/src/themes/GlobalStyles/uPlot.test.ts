import { colorManipulator, getThemeById, type GrafanaTheme2 } from '@grafana/data';

import { getGridColor } from '../../components/uPlot/config/UPlotAxisBuilder';

import { getCrosshairColor, getUplotStyles } from './uPlot';

// Both the crosshair and the gridlines are alpha-based, and getContrastRatio only composites its
// background argument, so flatten each colour against what it actually draws on first.
const flatten = (color: string, background: string) => colorManipulator.onBackground(color, background).toRgbString();

// Scoped to the shipped defaults: the 18 extra themes have designer-chosen tokens whose contrast is
// a pre-existing concern, not something this crosshair colour controls.
const THEME_IDS = ['dark', 'light', 'visual_refresh_dark', 'visual_refresh_light'];

// Every surface the crosshair is drawn over.
const SURFACES = [
  { surface: 'panel background', color: (theme: GrafanaTheme2) => theme.components.panel.background },
  { surface: 'dashboard canvas', color: (theme: GrafanaTheme2) => theme.colors.background.canvas },
  {
    surface: 'gridline',
    color: (theme: GrafanaTheme2) => flatten(getGridColor(theme), theme.components.panel.background),
  },
];

describe('getUplotStyles', () => {
  it.each(THEME_IDS.flatMap((themeId) => SURFACES.map((surface) => ({ themeId, ...surface }))))(
    'crosshair clears the contrast threshold against the $surface in $themeId',
    ({ themeId, color }) => {
      const theme = getThemeById(themeId);
      const crosshair = flatten(getCrosshairColor(theme), theme.components.panel.background);

      expect(colorManipulator.getContrastRatio(crosshair, color(theme))).toBeGreaterThanOrEqual(
        theme.colors.contrastThreshold
      );
    }
  );

  it.each(THEME_IDS)('draws both crosshair orientations as 1px dashed in the theme colour for %s', (themeId) => {
    const theme = getThemeById(themeId);
    const { styles } = getUplotStyles(theme);

    expect(styles).toContain(`border-right:1px dashed ${getCrosshairColor(theme)}`);
    expect(styles).toContain(`border-bottom:1px dashed ${getCrosshairColor(theme)}`);
  });
});
