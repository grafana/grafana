import tinycolor from 'tinycolor2';

import { createTheme } from '@grafana/data';

import { getTagColor } from './tags';

describe.each(['dark', 'light'] as const)('tonal tag colors in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });

  it.each(['#73BF69', '#FF9830', '#F2495C', '#000000', '#ffffff', '#808080', '#0000ff', '#ffff00'])(
    'provides at least 4.5:1 text contrast for %s',
    (base) => {
      const { background, text } = getTagColor(base, theme);
      expect(tinycolor.readability(background, text)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('keeps transparent mappings transparent with theme text', () => {
    expect(getTagColor('transparent', theme)).toEqual({
      background: 'rgba(0,0,0,0)',
      text: theme.colors.text.primary,
      color: 'rgba(0,0,0,0)',
      borderColor: theme.colors.text.primary,
    });
  });
});

it('preserves the base hue in a dark tonal pair', () => {
  expect(getTagColor('#FF0000', createTheme())).toMatchObject({
    background: 'rgb(38, 0, 0)',
    text: 'rgb(255, 166, 166)',
  });
});
