import { createTheme } from '@grafana/data';

import { getHiddenMaskStyles } from './utils';

describe('getHiddenMaskStyles', () => {
  it('desaturates and applies a stronger dim in dark mode', () => {
    const styles = getHiddenMaskStyles(createTheme({ colors: { mode: 'dark' } }));

    expect(styles).toEqual({ opacity: 0.6, filter: 'grayscale(0.8)' });
  });

  it('desaturates and applies a lighter dim in light mode', () => {
    const styles = getHiddenMaskStyles(createTheme({ colors: { mode: 'light' } }));

    expect(styles).toEqual({ opacity: 0.7, filter: 'grayscale(0.8)' });
  });
});
