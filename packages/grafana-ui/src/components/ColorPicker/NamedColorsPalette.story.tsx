import React from 'react';
import { storiesOf } from '@storybook/react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { getColorName, getColorDefinitionByName } from '../../utils/namedColorsPalette';
import { select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { UseState } from '../../utils/storybook/UseState';

const BasicGreen = getColorDefinitionByName('green');
const BasicRed = getColorDefinitionByName('red');
const LightBlue = getColorDefinitionByName('light-blue');

const NamedColorsPaletteStories = storiesOf('UI/ColorPicker/Palettes/NamedColorsPalette', module);

NamedColorsPaletteStories.addDecorator(withCenteredStory);

NamedColorsPaletteStories.add('Named colors swatch - support for named colors', () => {
  const selectedColor = select(
    'Selected color',
    {
      Green: 'green',
      Red: 'red',
      'Light blue': 'light-blue',
    },
    'red'
  );

  return (
    <UseState initialState={selectedColor}>
      {(selectedColor, updateSelectedColor) => {
        return renderComponentWithTheme(NamedColorsPalette, {
          color: selectedColor,
          onChange: updateSelectedColor,
        });
      }}
    </UseState>
  );
}).add('Named colors swatch - support for hex values', () => {
  const selectedColor = select(
    'Selected color',
    {
      Green: BasicGreen.variants.dark,
      Red: BasicRed.variants.dark,
      'Light blue': LightBlue.variants.dark,
    },
    'red'
  );
  return (
    <UseState initialState={selectedColor}>
      {(selectedColor, updateSelectedColor) => {
        return renderComponentWithTheme(NamedColorsPalette, {
          color: getColorName(selectedColor),
          onChange: updateSelectedColor,
        });
      }}
    </UseState>
  );
});
