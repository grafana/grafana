import tinycolor from 'tinycolor2';

import { createTheme } from '@grafana/data';

import { getTagColor } from './tags';

describe.each(['dark', 'light'] as const)('tonal tag colors in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const edgeCases = [
    '#ffffff',
    '#000000',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#00ffff',
    '#ff00ff',
    '#808080',
    '#7f8081',
  ];
  const colors = [...theme.components.tag.colors.map(({ background }) => background), ...edgeCases];

  it.each(colors)('provides at least 4.5:1 text contrast for %s', (base) => {
    const { background, text } = getTagColor(base, theme);
    expect(tinycolor.readability(background, text)).toBeGreaterThanOrEqual(4.5);
  });

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
    background: 'rgb(255, 0, 0)',
    text: 'rgb(55, 0, 0)',
  });
});

it.each([
  ['dark', '#ffff00', 'rgb(255, 255, 0)', 'rgb(117, 117, 0)'],
  ['light', '#000080', 'rgb(0, 0, 128)', 'rgb(78, 131, 251)'],
] as const)('uses the smaller tonal shift even when it opposes %s mode', (mode, source, background, text) => {
  expect(getTagColor(source, createTheme({ colors: { mode } }))).toMatchObject({ background, text });
});
