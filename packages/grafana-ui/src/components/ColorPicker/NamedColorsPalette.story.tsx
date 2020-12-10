import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { UseState } from '../../utils/storybook/UseState';
import mdx from './ColorPicker.mdx';

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
