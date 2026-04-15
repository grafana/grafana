import { type GrafanaTheme2 } from '@grafana/data';

import { getGlobalStyles } from './globalStyles';

function createMockTheme(): GrafanaTheme2 {
  return {
    colors: {
      border: { weak: 'rgba(0,0,0,0.1)' },
      text: { primary: '#111' },
      background: { primary: '#fff', secondary: '#f5f5f5' },
      secondary: { text: '#fff', main: '#1f77d0', shade: '#1664b0' },
    },
  } as GrafanaTheme2;
}

describe('getGlobalStyles', () => {
  it('should return serialized Emotion styles for OpenLayers map controls', () => {
    const styles = getGlobalStyles(createMockTheme());
    expect(styles).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        styles: expect.any(String),
      })
    );
  });

  it('should emit CSS rules for scale line, controls, and attribution', () => {
    const { styles } = getGlobalStyles(createMockTheme()) as { styles: string };
    expect(styles).toContain('.ol-scale-line{');
    expect(styles).toContain('.ol-scale-line-inner{');
    expect(styles).toContain('.ol-control{');
    expect(styles).toContain('.ol-control:hover{');
    expect(styles).toContain('.ol-control button{');
    expect(styles).toContain('.ol-control button:hover{');
    expect(styles).toContain('.ol-control button:focus{');
    expect(styles).toContain('.ol-attribution ul{');
    expect(styles).toContain('.ol-attribution:not(.ol-collapsed){');
  });

  it('should interpolate Grafana theme tokens into control styles', () => {
    const theme = createMockTheme();
    const { styles } = getGlobalStyles(theme) as { styles: string };
    expect(styles).toContain(theme.colors.border.weak);
    expect(styles).toContain(theme.colors.text.primary);
    expect(styles).toContain(theme.colors.background.primary);
    expect(styles).toContain(theme.colors.background.secondary);
    expect(styles).toContain(theme.colors.secondary.main);
    expect(styles).toContain(theme.colors.secondary.shade);
  });

  it('should change serialized CSS when theme colors change', () => {
    const a = getGlobalStyles(createMockTheme()) as { styles: string };
    const b = getGlobalStyles({
      ...createMockTheme(),
      colors: {
        ...createMockTheme().colors,
        border: { weak: 'rgba(9,9,9,0.99)' },
      },
    } as GrafanaTheme2) as { styles: string };
    expect(a.styles).not.toEqual(b.styles);
    expect(b.styles).toContain('rgba(9,9,9,0.99)');
  });
});
