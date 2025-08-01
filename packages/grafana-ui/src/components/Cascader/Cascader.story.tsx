import { StoryFn, Meta } from '@storybook/react';
import { useId, useState } from 'react';

import { Field } from '../Forms/Field';

import { Cascader, CascaderOption } from './Cascader';
import mdx from './Cascader.mdx';

const onSelect = (val: string) => console.log(val);
const options = [
  {
    label: 'First',
    value: '1',
    items: [
      {
        label: 'Second',
        value: '2',
      },
      {
        label: 'Third',
        value: '3',
      },
      {
        label: 'Fourth',
        value: '4',
      },
    ],
  },
  {
    label: 'FirstFirst',
    value: '5',
  },
];

const meta: Meta<typeof Cascader> = {
  title: 'Inputs/Cascader',
  component: Cascader,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [
        'placeholder',
        'initialValue',
        'changeOnSelect',
        'onSelect',
        'loadData',
        'onChange',
        'onPopupVisibleChange',
        'formatCreateLabel',
      ],
    },
  },
  args: {
    onSelect,
    options,
  },
  argTypes: {
    width: { control: { type: 'range', min: 0, max: 70 } },
  },
};

const Template: StoryFn<typeof Cascader> = (args) => {
  const id = useId();
  return (
    <Field label="Cascader field">
      <Cascader {...args} id={id} />
    </Field>
  );
};

export const Simple = Template.bind({});
Simple.args = {
  separator: '',
};

export const WithInitialValue = Template.bind({});
WithInitialValue.args = {
  initialValue: '3',
};

export const WithCustomValue = Template.bind({});
WithCustomValue.args = {
  initialValue: 'Custom Initial Value',
  allowCustomValue: true,
  formatCreateLabel: (val) => 'Custom Label' + val,
};

export const WithDisplayAllSelectedLevels = Template.bind({});
WithDisplayAllSelectedLevels.args = {
  displayAllSelectedLevels: true,
  separator: ',',
};

export const WithOptionsStateUpdate = () => {
  const [updatedOptions, setOptions] = useState<CascaderOption[]>([
    {
      label: 'Initial state option',
      value: 'initial',
    },
  ]);
  const id = useId();

  setTimeout(() => setOptions(options), 2000);

  return (
    <Field label="Cascader field with updated options">
      <Cascader options={updatedOptions} onSelect={onSelect} id={id} />
    </Field>
  );
};

export default meta;
