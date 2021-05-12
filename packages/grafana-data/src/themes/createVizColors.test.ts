import { createColors } from './createColors';
import { createVizColors } from './createVizColors';

describe('createVizColors', () => {
  const darkThemeColors = createColors({});
  const vizColors = createVizColors(darkThemeColors);

  it('Can map named colors to real color', () => {
    expect(vizColors.byName('green')).toBe('#73BF69');
  });

  it('Can map named colors using old aliases to real color', () => {
    expect(vizColors.byName('dark-green')).toBe('#37872D');
  });

  it('Can get color by index', () => {
    expect(vizColors.byIndex(133)).toBe('#FADE2A');
  });

  it('returns color if specified as hex or rgb/a', () => {
    expect(vizColors.byName('#ff0000')).toBe('#ff0000');
    expect(vizColors.byName('#ff0000')).toBe('#ff0000');
    expect(vizColors.byName('#FF0000')).toBe('#FF0000');
    expect(vizColors.byName('#CCC')).toBe('#CCC');
    expect(vizColors.byName('rgb(0,0,0)')).toBe('rgb(0,0,0)');
    expect(vizColors.byName('rgba(0,0,0,1)')).toBe('rgba(0,0,0,1)');
  });

  it('returns hex for named color that is not a part of named colors palette', () => {
    expect(vizColors.byName('lime')).toBe('#00ff00');
  });
});
