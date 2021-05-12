import { createColors } from './createColors';
import { createVizColors } from './createVizColors';

describe('createVizColors', () => {
  const darkThemeColors = createColors({});

  it('Can map named colors to real color', () => {
    const vizColors = createVizColors(darkThemeColors);
    expect(vizColors.byName('green3')).toBe('#2DC88F');
  });

  it('Can map named colors using old aliases to real color', () => {
    const vizColors = createVizColors(darkThemeColors);
    expect(vizColors.byName('dark-green')).toBe('#1B855E');
  });

  it('Can get color by index', () => {
    const vizColors = createVizColors(darkThemeColors);
    expect(vizColors.byIndex(133)).toBe('#ECBB09');
  });
});
