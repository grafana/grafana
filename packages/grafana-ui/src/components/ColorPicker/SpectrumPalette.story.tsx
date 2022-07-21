import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, Story } from '@storybook/react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

import mdx from './ColorPicker.mdx';
import SpectrumPalette, { SpectrumPaletteProps } from './SpectrumPalette';

const meta: Meta = {
  title: 'Pickers and Editors/ColorPicker/Palettes/SpectrumPalette',
  component: SpectrumPalette,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange'],
    },
  },
  args: {
    color: 'red',
  },
};

export const Simple: Story<SpectrumPaletteProps> = ({ color }) => {
  const [, updateArgs] = useArgs();
  return renderComponentWithTheme(SpectrumPalette, {
    color,
    onChange: (color: string) => {
      action('Color changed')(color);
      updateArgs({ color });
    },
  });
};

export default meta;
