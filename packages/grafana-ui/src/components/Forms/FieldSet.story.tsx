import { Meta, StoryFn } from '@storybook/react';

import { Input, Form, FieldSet, Field } from '@grafana/ui';

import { Button } from '../Button';

import { Props } from './FieldSet';
import mdx from './FieldSet.mdx';

const meta: Meta<typeof FieldSet> = {
  title: 'Forms/FieldSet',
  component: FieldSet,
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

export const Basic: StoryFn<typeof FieldSet> = (args: Props) => {
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
