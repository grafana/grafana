import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

import mdx from './ColorPicker.mdx';
import SpectrumPalette from './SpectrumPalette';

const meta: ComponentMeta<typeof SpectrumPalette> = {
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

export const Simple: ComponentStory<typeof SpectrumPalette> = ({ color }) => {
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
