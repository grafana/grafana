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
  it('should return Emotion styles for OpenLayers map controls', () => {
    const styles = getGlobalStyles(createMockTheme());
    expect(styles).toBeDefined();
    expect(typeof styles).toBe('object');
  });
});
