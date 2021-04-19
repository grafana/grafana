import React from 'react';
import { Story } from '@storybook/react';
import { ValuePicker } from '@grafana/ui';
import { generateOptions } from '../Select/mockOptions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { getAvailableIcons } from '../../types';
import mdx from './ValuePicker.mdx';
import { ValuePickerProps } from './ValuePicker';

export default {
  title: 'Pickers and Editors/ValuePicker',
  component: ValuePicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      exclude: ['onChange', 'options'],
    },
  },
  argTypes: {
    variant: {
      control: {
        type: 'select',
        options: ['primary', 'secondary', 'destructive', 'link'],
      },
    },
    icon: {
      control: {
        type: 'select',
        options: getAvailableIcons(),
      },
    },
  },
};
const options = generateOptions();

export const Simple: Story<ValuePickerProps<string>> = (args) => {
  return (
    <div style={{ width: '200px' }}>
      <ValuePicker {...args} options={options} onChange={(v) => console.log(v)} />
    </div>
  );
};
Simple.args = {
  label: 'Pick an option',
  variant: 'primary',
  size: 'md',
  isFullWidth: false,
  icon: 'plus',
  menuPlacement: 'auto',
};
