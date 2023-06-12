import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { UnitPicker, UnitPickerProps } from './UnitPicker';
import mdx from './UnitPicker.mdx';

const meta: Meta<typeof UnitPicker> = {
  title: 'Pickers and Editors/UnitPicker',
  component: UnitPicker,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange', 'value'],
    },
    docs: mdx,
  },
};

export const Basic: StoryFn<typeof UnitPicker> = (args: UnitPickerProps) => <UnitPicker {...args} />;

Basic.args = {
  onChange: action('onChange fired'),
  width: 30,
};

export default meta;
