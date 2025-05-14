import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

import { InlineField } from './InlineField';
import mdx from './InlineField.mdx';

const meta: Meta<typeof InlineField> = {
  title: 'Forms/InlineField',
  component: InlineField,
  argTypes: {
    label: { control: { type: 'text' } },
    labelWidth: { control: { type: 'number' } },
    tooltip: { control: { type: 'text' } },
    error: { control: { type: 'text' } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['htmlFor', 'className', 'children'],
    },
  },
};

export const basic: StoryFn<typeof InlineField> = (args) => {
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

basic.args = {
  label: 'Inline field',
  transparent: false,
  grow: false,
  shrink: false,
  disabled: false,
  interactive: false,
  loading: false,
  required: false,
  invalid: false,
  validationMessageHorizontalOverflow: false,
};

export const withTooltip: StoryFn<typeof InlineField> = (args) => {
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

withTooltip.args = {
  tooltip: 'Tooltip',
  ...basic.args,
  label: 'Label',
};

export const grow: StoryFn<typeof InlineField> = (args) => {
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

grow.args = {
  ...basic.args,
  label: 'Label',
  grow: true,
};

export const withSelect: StoryFn<typeof InlineField> = (args) => {
  return (
    <InlineField {...args}>
      <Select
        width={16}
        onChange={action('item selected')}
        options={[
          { value: 1, label: 'One' },
          { value: 2, label: 'Two' },
        ]}
      />
    </InlineField>
  );
};

withSelect.args = {
  ...basic.args,
  label: 'Select option',
};

export const multiple: StoryFn<typeof InlineField> = () => {
  return (
    <>
      <InlineField label="Field 1">
        <Input placeholder="Inline input" />
      </InlineField>
      <InlineField label="Field 2">
        <Input placeholder="Inline input" />
      </InlineField>
      <InlineField label="Field 3">
        <Input placeholder="Inline input" />
      </InlineField>
    </>
  );
};

export const error: StoryFn<typeof InlineField> = (args) => {
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

error.args = {
  ...basic.args,
  label: 'Label',
  error: 'Error',
  invalid: true,
};

export default meta;
