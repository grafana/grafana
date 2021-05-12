import { createColors } from './createColors';
import { createVizColors } from './createVizColors';

describe('createVizColors', () => {
  const darkThemeColors = createColors({});
  const vizColors = createVizColors(darkThemeColors);

  it('Can map named colors to real color', () => {
    expect(vizColors.getByName('green')).toBe('#73BF69');
  });

  it('Can map named colors using old aliases to real color', () => {
    expect(vizColors.getByName('dark-green')).toBe('#37872D');
  });

  it('Can get color from palette', () => {
    expect(vizColors.palette[0]).not.toBeUndefined();
  });

  it('returns color if specified as hex or rgb/a', () => {
    expect(vizColors.getByName('#ff0000')).toBe('#ff0000');
    expect(vizColors.getByName('#ff0000')).toBe('#ff0000');
    expect(vizColors.getByName('#FF0000')).toBe('#FF0000');
    expect(vizColors.getByName('#CCC')).toBe('#CCC');
    expect(vizColors.getByName('rgb(0,0,0)')).toBe('rgb(0,0,0)');
    expect(vizColors.getByName('rgba(0,0,0,1)')).toBe('rgba(0,0,0,1)');
  });

  it('returns hex for named color that is not a part of named colors palette', () => {
    expect(vizColors.getByName('lime')).toBe('#00ff00');
  });
});
