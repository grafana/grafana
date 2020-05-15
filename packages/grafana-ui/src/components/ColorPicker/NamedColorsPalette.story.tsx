import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { getColorName, getColorDefinitionByName } from '@grafana/data';
import { select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { UseState } from '../../utils/storybook/UseState';
import mdx from './ColorPicker.mdx';

const BasicGreen = getColorDefinitionByName('green');
const BasicRed = getColorDefinitionByName('red');
const LightBlue = getColorDefinitionByName('light-blue');

export default {
  title: 'Pickers and Editors/ColorPicker/Palettes/NamedColorsPalette',
  component: NamedColorsPalette,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const namedColors = () => {
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
};

export const hexValues = () => {
  let hexVals: any = {};
  hexVals[BasicGreen.variants.dark] = BasicGreen.variants.dark;
  hexVals[BasicRed.variants.dark] = BasicRed.variants.dark;
  hexVals[LightBlue.variants.dark] = LightBlue.variants.dark;

  const selectedColor = select('Selected color', hexVals, 'red');
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
};
