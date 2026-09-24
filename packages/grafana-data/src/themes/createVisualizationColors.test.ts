import * as colorManipulator from './colorManipulator';
import { createColors } from './createColors';
import { createVisualizationColors } from './createVisualizationColors';

describe('createVizColors', () => {
  const darkThemeColors = createColors({});
  const vizColors = createVisualizationColors(darkThemeColors);

  it('Can map named colors to real color', () => {
    expect(vizColors.getColorByName('green')).toBe('#73BF69');
  });

  it('Can map named colors using old aliases to real color', () => {
    expect(vizColors.getColorByName('dark-green')).toBe('#37872D');
  });

  it('Can get color from palette', () => {
    expect(vizColors.palette[0]).not.toBeUndefined();
  });

  it('returns color if specified as hex or rgb/a', () => {
    expect(vizColors.getColorByName('#ff0000')).toBe('#ff0000');
    expect(vizColors.getColorByName('#ff0000')).toBe('#ff0000');
    expect(vizColors.getColorByName('#FF0000')).toBe('#FF0000');
    expect(vizColors.getColorByName('#CCC')).toBe('#CCC');
    expect(vizColors.getColorByName('rgb(0,0,0)')).toBe('rgb(0,0,0)');
    expect(vizColors.getColorByName('rgba(0,0,0,1)')).toBe('rgba(0,0,0,1)');
  });

  it('returns hex for named color that is not a part of named colors palette', () => {
    expect(vizColors.getColorByName('lime')).toBe('#00ff00');
  });

  it.each([
    ['grey', '#808080'],
    ['gray', '#808080'],
    ['darkgrey', '#a9a9a9'],
    ['darkslategrey', '#2f4f4f'],
    ['dimgrey', '#696969'],
    ['lightgray', '#d3d3d3'],
    ['lightgrey', '#d3d3d3'],
    ['lightslategrey', '#778899'],
    ['slategrey', '#708090'],
    ['indianred', '#cd5c5c'],
    ['Grey', '#808080'],
  ])('resolves CSS color name %s to hex', (name, hex) => {
    expect(vizColors.getColorByName(name)).toBe(hex);
  });

  it('resolves CSS named colors to a value colorManipulator can parse', () => {
    expect(() => colorManipulator.alpha(vizColors.getColorByName('grey'), 0.1)).not.toThrow();
  });

  it.each(['transparent', 'Transparent', 'TRANSPARENT'])('resolves %s to the theme transparent color', (name) => {
    const lightVizColors = createVisualizationColors(createColors({ mode: 'light' }));

    expect(vizColors.getColorByName(name)).toBe('rgba(0,0,0,0)');
    expect(lightVizColors.getColorByName(name)).toBe('rgba(255, 255, 255, 0)');
  });

  it('returns non-name color formats and unknown names unchanged', () => {
    expect(vizColors.getColorByName('hsl(0, 100%, 50%)')).toBe('hsl(0, 100%, 50%)');
    expect(vizColors.getColorByName('not-a-color')).toBe('not-a-color');
  });
});
