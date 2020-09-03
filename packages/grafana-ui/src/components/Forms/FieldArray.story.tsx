import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Form, Input, Button, HorizontalGroup } from '@grafana/ui';
import { FieldArray } from './FieldArray';
import mdx from './FieldArray.mdx';

export default {
  title: 'Forms/FieldArray',
  component: FieldArray,
  decorators: [withStoryContainer, withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const defaultValues = {
    people: [{ firstName: 'Janis', lastName: 'Joplin' }],
  };
  return (
    <Form onSubmit={values => console.log(values)} defaultValues={defaultValues}>
      {({ control, register }) => (
        <div>
          <FieldArray control={control} name="people">
            {({ fields, append }) => (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  {fields.map((field, index) => (
                    <HorizontalGroup key={field.id}>
                      <Input ref={register()} name={`people[${index}].firstName`} value={field.firstName} />
                      <Input ref={register()} name={`people[${index}].lastName`} value={field.lastName} />
                    </HorizontalGroup>
                  ))}
                </div>
                <Button
                  style={{ marginRight: '1rem' }}
                  onClick={() => append({ firstName: 'Roger', lastName: 'Waters' })}
                >
                  Add another
                </Button>
              </>
            )}
          </FieldArray>
          <Button type="submit">Submit</Button>
        </div>
      )}
    </Form>
  );
};
