import { Meta, StoryFn } from '@storybook/react';
import { useId, useState } from 'react';

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
  },
};

export const basic: StoryFn<typeof InlineField> = (args) => {
  const id = useId();
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" id={id} />
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
  const id = useId();
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" id={id} />
    </InlineField>
  );
};

withTooltip.args = {
  tooltip: 'Tooltip',
  ...basic.args,
  label: 'Label',
};

export const grow: StoryFn<typeof InlineField> = (args) => {
  const id = useId();
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" id={id} />
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
  const id = useId();
  return (
    <InlineField {...args}>
      <Combobox width={16} onChange={(v) => setSelected(v.value)} options={comboboxOptions} value={selected} id={id} />
    </InlineField>
  );
};

withCombobox.args = {
  ...basic.args,
  label: 'Combobox option',
};

export const multiple: StoryFn<typeof InlineField> = () => {
  const id1 = useId();
  const id2 = useId();
  const id3 = useId();
  return (
    <>
      <InlineField label="Field 1">
        <Input placeholder="Inline input" id={id1} />
      </InlineField>
      <InlineField label="Field 2">
        <Input placeholder="Inline input" id={id2} />
      </InlineField>
      <InlineField label="Field 3">
        <Input placeholder="Inline input" id={id3} />
      </InlineField>
    </>
  );
};

export const error: StoryFn<typeof InlineField> = (args) => {
  const id = useId();
  return (
    <InlineField {...args}>
      <Input placeholder="Inline input" id={id} />
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
