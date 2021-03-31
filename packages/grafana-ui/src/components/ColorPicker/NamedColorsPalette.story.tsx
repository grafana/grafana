import React from 'react';
import { NamedColorsPalette, NamedColorsPaletteProps } from './NamedColorsPalette';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';
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
  },
  argTypes: {
    selectedColor: { control: { type: 'select', options: ['green', 'red', 'light-blue', 'yellow'] } },
    theme: NOOP_CONTROL,
    color: NOOP_CONTROL,
  },
};

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
