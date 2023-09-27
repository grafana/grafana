import { createTheme } from '@grafana/data';

import { getBarColorByPackage, getBarColorByValue } from './colors';

describe('getBarColorByValue', () => {
  it('converts value to color', () => {
    expect(getBarColorByValue(1, 100, 0, 1).toHslString()).toBe('hsl(50, 100%, 65%)');
    expect(getBarColorByValue(100, 100, 0, 1).toHslString()).toBe('hsl(0, 100%, 72%)');
    expect(getBarColorByValue(10, 100, 0, 0.1).toHslString()).toBe('hsl(0, 100%, 72%)');
  });
});

describe('getBarColorByPackage', () => {
  it('converts package to color', () => {
    const theme = createTheme();
    const c = getBarColorByPackage('net/http.HandlerFunc.ServeHTTP', theme);
    expect(c.toHslString()).toBe('hsl(246, 40%, 65%)');
    // same package should have same color
    expect(getBarColorByPackage('net/http.(*conn).serve', theme).toHslString()).toBe(c.toHslString());

    expect(getBarColorByPackage('github.com/grafana/phlare/pkg/util.Log.Wrap.func1', theme).toHslString()).toBe(
      'hsl(105, 40%, 76%)'
    );
  });
});
