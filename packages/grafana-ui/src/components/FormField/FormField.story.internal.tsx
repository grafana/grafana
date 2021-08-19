import React from 'react';
import { Meta, Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FormField, Props } from './FormField';

export default {
  title: 'Forms/Legacy/FormField',
  component: FormField,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['inputEl'],
    },
  },
  args: {
    inputWidth: 20,
    labelWidth: 10,
    label: 'Test',
  },
  argTypes: {
    inputWidth: { control: { type: 'range', min: 5, max: 30 } },
    labelWidth: { control: { type: 'range', min: 5, max: 30 } },
    tooltip: { control: { type: 'text' } },
  },
} as Meta;

export const Basic: Story<Props> = (args) => {
  return <FormField {...args} />;
};

export const WithTooltip: Story<Props> = ({ tooltip, ...args }) => {
  return <FormField {...args} tooltip={tooltip} />;
};

WithTooltip.args = {
  tooltip: 'This is a tooltip with information about this FormField',
};
