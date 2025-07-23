import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';

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
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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

export const withCombobox: StoryFn<typeof InlineField> = (args) => {
  const comboboxOptions = [
    { value: 1, label: 'One' },
    { value: 2, label: 'Two' },
  ];
  const [selected, setSelected] = useState(1);
  return (
    <InlineField {...args}>
      <Combobox width={16} onChange={(v) => setSelected(v.value)} options={comboboxOptions} value={selected} />
    </InlineField>
  );
};

withCombobox.args = {
  ...basic.args,
  label: 'Combobox option',
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
