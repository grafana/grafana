import { createTheme } from '@grafana/data';

import { getPreviewTheme } from './previewTheme';

describe('getPreviewTheme', () => {
  it('maps a derived theme to preview tokens', () => {
    const theme = createTheme({ colors: { mode: 'dark' } });
    const tokens = getPreviewTheme(theme);

    expect(tokens.dashboardBackground).toBe(theme.colors.background.canvas);
    expect(tokens.panelBackground).toBe(theme.components.panel.background);
    expect(tokens.primary).toBe(theme.colors.primary.main);
    expect(tokens.seriesPalette[0]).toBe(theme.colors.primary.main);
    expect(tokens.seriesPalette).toHaveLength(6);
  });

  it('reflects overrides through createTheme', () => {
    const theme = createTheme({ colors: { mode: 'dark', primary: { main: '#ff0000' } } });
    const tokens = getPreviewTheme(theme);

    expect(tokens.primary).toBe('#ff0000');
    expect(tokens.seriesPalette[0]).toBe('#ff0000');
  });

  it('derives text scale and panel padding from the theme', () => {
    const theme = createTheme({ colors: { mode: 'dark' } });
    const tokens = getPreviewTheme(theme);

    expect(tokens.textScale).toBe(theme.typography.fontSize / 14);
    expect(tokens.panelPadding).toBe(theme.spacing.gridSize * 2);
  });
});
