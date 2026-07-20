import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { action } from 'storybook/actions';

import { UnitPicker, type UnitPickerProps } from './UnitPicker';

const meta: Meta<typeof UnitPicker> = {
  title: 'Pickers/UnitPicker',
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
