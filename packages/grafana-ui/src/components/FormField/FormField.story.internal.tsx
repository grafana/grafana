import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { FormField } from './FormField';

const meta: ComponentMeta<typeof FormField> = {
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
};

export const Basic: ComponentStory<typeof FormField> = (args) => {
  return <FormField {...args} />;
};

export const WithTooltip: ComponentStory<typeof FormField> = ({ tooltip, ...args }) => {
  return <FormField {...args} tooltip={tooltip} />;
};

WithTooltip.args = {
  tooltip: 'This is a tooltip with information about this FormField',
};

export default meta;
