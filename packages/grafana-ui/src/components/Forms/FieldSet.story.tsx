import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FieldSet } from './FieldSet';
import { Form } from './Form';
import { Field } from './Field';
import { Input } from '../Input/Input';
import mdx from './FieldSet.mdx';
import { Button } from '../Button';

export default {
  title: 'Forms/FieldSet',
  component: FieldSet,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <Form onSubmit={() => console.log('Submit')}>
      {() => (
        <>
          <FieldSet label="Details">
            <Field label="Name">
              <Input name="name" />
            </Field>
            <Field label="Email">
              <Input name="email" />
            </Field>
          </FieldSet>

          <FieldSet label="Preferences">
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
