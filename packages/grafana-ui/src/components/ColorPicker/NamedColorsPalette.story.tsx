import { Meta, Story } from '@storybook/react';
import React, { useState } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './ColorPicker.mdx';
import { NamedColorsPalette, NamedColorsPaletteProps } from './NamedColorsPalette';

const meta: Meta = {
  title: 'Pickers and Editors/ColorPicker/Palettes/NamedColorsPalette',
  component: NamedColorsPalette,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['theme', 'color'],
    },
  },
  argTypes: {
    selectedColor: { control: { type: 'select', options: ['green', 'red', 'light-blue', 'yellow'] } },
  },
};

interface StoryProps extends Partial<NamedColorsPaletteProps> {
  selectedColor: string;
}

export const NamedColors: Story<StoryProps> = ({ selectedColor }) => {
  const [color, setColor] = useState('green');
  return <NamedColorsPalette color={color} onChange={setColor} />;
};

NamedColors.args = {
  color: 'green',
};

export default meta;
