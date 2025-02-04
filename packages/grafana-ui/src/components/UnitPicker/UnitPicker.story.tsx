import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { UnitPicker, UnitPickerProps } from './UnitPicker';

const meta: Meta<typeof UnitPicker> = {
  title: 'Pickers and Editors/UnitPicker',
  component: UnitPicker,
  parameters: {
    controls: {
      exclude: ['onChange', 'value'],
    },
  },
};

export const Basic: StoryFn<typeof UnitPicker> = (args: UnitPickerProps) => <UnitPicker {...args} />;

Basic.args = {
  onChange: action('onChange fired'),
  width: 30,
};

export default meta;
