import { Meta, StoryFn } from '@storybook/react';

import { FormField } from './FormField';

const meta: Meta<typeof FormField> = {
  title: 'Forms/Deprecated/FormField',
  component: FormField,
  parameters: {
    controls: {
      exclude: ['inputEl'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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

export const Basic: StoryFn<typeof FormField> = (args) => {
  return <FormField {...args} />;
};

export const WithTooltip: StoryFn<typeof FormField> = ({ tooltip, ...args }) => {
  return <FormField {...args} tooltip={tooltip} />;
};

WithTooltip.args = {
  tooltip: 'This is a tooltip with information about this FormField',
};

export default meta;
