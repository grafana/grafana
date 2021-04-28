import React from 'react';
import { NamedColorsPalette, NamedColorsPaletteProps } from './NamedColorsPalette';
import { Meta, Story } from '@storybook/react';
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
    knobs: {
      disable: true,
    },
    controls: {
      exclude: ['theme', 'color'],
    },
  },
  argTypes: {
    selectedColor: { control: { type: 'select', options: ['green', 'red', 'light-blue', 'yellow'] } },
  },
} as Meta;

interface StoryProps extends Partial<NamedColorsPaletteProps> {
  selectedColor: string;
}

export const NamedColors: Story<StoryProps> = ({ selectedColor }) => {
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
NamedColors.args = {
  selectedColor: 'red',
};
