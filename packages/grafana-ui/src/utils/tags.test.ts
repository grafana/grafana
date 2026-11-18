import tinycolor from 'tinycolor2';

import { createTheme } from '@grafana/data';

import { getTagColor } from './tags';

const TAG_TEXT_TARGET_CONTRAST = 7;
const TAG_TEXT_MIN_CONTRAST = 4.5;

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
    '#440154',
  ];
  const colors = [...theme.components.tag.colors.map(({ background }) => background), ...edgeCases];

  it.each(colors)('preserves the background and provides accessible text for %s', (base) => {
    const { background, text } = getTagColor(base, theme);
    const maximumContrast = Math.max(
      tinycolor.readability(background, '#000000'),
      tinycolor.readability(background, '#ffffff')
    );
    const requiredContrast =
      maximumContrast >= TAG_TEXT_TARGET_CONTRAST ? TAG_TEXT_TARGET_CONTRAST : TAG_TEXT_MIN_CONTRAST;

    expect(background).toBe(tinycolor(base).setAlpha(1).toRgbString());
    expect(tinycolor.readability(background, text)).toBeGreaterThanOrEqual(requiredContrast);
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

it.each([
  ['dark', '#ffff00', 'rgb(255, 255, 0)', 'rgb(87, 87, 1)'],
  ['light', '#000080', 'rgb(0, 0, 128)', 'rgb(131, 171, 255)'],
] as const)('uses the target-meeting text direction in %s mode', (mode, source, background, text) => {
  expect(getTagColor(source, createTheme({ colors: { mode } }))).toMatchObject({ background, text });
});

it.each([
  ['dark', 'rgb(255, 0, 0)', 'rgb(0, 0, 0)'],
  ['light', 'rgb(255, 0, 0)', 'rgb(0, 0, 0)'],
] as const)('uses the legible red pair in %s mode', (mode, background, text) => {
  expect(getTagColor('#ff0000', createTheme({ colors: { mode } }))).toMatchObject({ background, text });
});

it.each([
  ['dark', 'rgb(0, 0, 0)'],
  ['light', 'rgb(255, 255, 255)'],
] as const)('prefers the %s theme direction when purple candidates have similar contrast', (mode, text) => {
  expect(getTagColor('#A352CC', createTheme({ colors: { mode } }))).toMatchObject({
    background: 'rgb(163, 82, 204)',
    text,
  });
});
