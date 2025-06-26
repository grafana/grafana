import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import mdx from './ColorPicker.mdx';
import { NamedColorsPalette } from './NamedColorsPalette';
import SpectrumPalette from './SpectrumPalette';

// TODO: Note: these components aren't exported from the package

const meta: Meta = {
  title: 'Pickers/Development/ColorPickerPalettes',
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['theme', 'color'],
    },
  },
  args: {
    color: 'green',
  },
};

export const NamedColors: StoryFn<typeof NamedColorsPalette> = ({ color }) => {
  const [colorVal, setColor] = useState(color);
  return <NamedColorsPalette color={colorVal} onChange={setColor} />;
};

export const Spectrum: StoryFn<typeof SpectrumPalette> = ({ color }) => {
  const [, updateArgs] = useArgs();
  return (
    <SpectrumPalette
      color={color}
      onChange={(color: string) => {
        action('Color changed')(color);
        updateArgs({ color });
      }}
    />
  );
};

export default meta;
