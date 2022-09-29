import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { useState, useCallback } from 'react';

import { VerticalGroup } from '../Layout/Layout';

import { Checkbox } from './Checkbox';
import mdx from './Checkbox.mdx';
import { Field } from './Field';

const meta: ComponentMeta<typeof Checkbox> = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['value', 'htmlValue'],
    },
  },
};

export const Basic: ComponentStory<typeof Checkbox> = (args) => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback((e) => setChecked(e.currentTarget.checked), [setChecked]);
  return (
    <div>
      <Checkbox value={checked} onChange={onChange} {...args} />
    </div>
  );
};

Basic.args = {
  label: 'Skip TLS cert validation',
  description: 'Set to true if you want to skip TLS cert validation',
  disabled: false,
};

export const StackedList = () => {
  return (
    <div>
      <VerticalGroup>
        <Checkbox
          defaultChecked={true}
          label="Skip TLS cert validation"
          description="Set to true if you want to skip TLS cert validation"
        />
        <Checkbox
          defaultChecked={true}
          label="Another checkbox"
          description="Another long description that does not make any sense"
        />
        <Checkbox
          defaultChecked={true}
          label="Another checkbox times 2"
          description="Another long description that does not make any sense or does it?"
        />
      </VerticalGroup>
    </div>
  );
};

export const InAField: ComponentStory<typeof Checkbox> = (args) => {
  return (
    <div>
      <Field {...args}>
        <Checkbox name="hide" id="hide" defaultChecked={true} />
      </Field>
    </div>
  );
};

InAField.args = {
  label: 'Hidden',
  description:
    'Annotation queries can be toggled on or of at the top of the dashboard. With this option checked this toggle will be hidden.',
  disabled: false,
};

export default meta;
