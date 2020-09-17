import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Input, Form, FieldSet, Field } from '@grafana/ui';
import { FormContextConsumer } from './FormContextConsumer';
import mdx from './FormContextConsumer.mdx';
import { Button } from '../Button';

export default {
  title: 'Forms/FormContextConsumer',
  component: FormContextConsumer,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <Form onSubmit={values => console.log('Submit', values)}>
      {() => (
        <div>
          <FormContextConsumer>
            {({ register }) => {
              return (
                <FieldSet label="Details">
                  <Field label="Name">
                    <Input ref={register({ required: true })} name="name" />
                  </Field>
                  <Field label="Email">
                    <Input ref={register({ required: true })} name="email" />
                  </Field>
                </FieldSet>
              );
            }}
          </FormContextConsumer>
          <Button variant="primary">Save</Button>
        </div>
      )}
    </Form>
  );
};
