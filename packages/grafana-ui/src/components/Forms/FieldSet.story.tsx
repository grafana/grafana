import { Meta, StoryFn } from '@storybook/react';
import { useId } from 'react';

import { Button } from '../Button/Button';
import { Input } from '../Input/Input';

import { Field } from './Field';
import { FieldSet, Props } from './FieldSet';
import mdx from './FieldSet.mdx';
import { Form } from './Form';

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
  const nameId = useId();
  const emailId = useId();
  const colorId = useId();
  const fontSizeId = useId();
  return (
    <Form onSubmit={() => console.log('Submit')}>
      {() => (
        <>
          <FieldSet {...args}>
            <Field label="Name">
              <Input name="name" id={nameId} />
            </Field>
            <Field label="Email">
              <Input name="email" id={emailId} />
            </Field>
            <Field label="Color">
              <Input name="color" id={colorId} />
            </Field>
            <Field label="Font size">
              <Input name="fontsize" id={fontSizeId} />
            </Field>
          </FieldSet>
          <Button variant="primary">Save</Button>
        </>
      )}
    </Form>
  );
};

export default meta;
