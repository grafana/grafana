import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { Input, Form, FieldSet, Field } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';

import { Props } from './FieldSet';
import mdx from './FieldSet.mdx';

const meta: ComponentMeta<typeof FieldSet> = {
  title: 'Forms/FieldSet',
  component: FieldSet,
  decorators: [withCenteredStory],
  args: {
    label: 'Default label',
  },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['children'],
    },
  },
  argTypes: {
    label: { control: 'text' },
  },
};

export const Basic: ComponentStory<typeof FieldSet> = (args: Props) => {
  return (
    <Form onSubmit={() => console.log('Submit')}>
      {() => (
        <>
          <FieldSet {...args}>
            <Field label="Name">
              <Input name="name" />
            </Field>
            <Field label="Email">
              <Input name="email" />
            </Field>
            <Field label="Color">
              <Input name="color" />
            </Field>
            <Field label="Font size">
              <Input name="fontsize" />
            </Field>
          </FieldSet>
          <Button variant="primary">Save</Button>
        </>
      )}
    </Form>
  );
};

export default meta;
