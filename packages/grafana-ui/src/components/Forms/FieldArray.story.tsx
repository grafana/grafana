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
  const defaultValues: any = {
    people: [{ firstName: 'Janis', lastName: 'Joplin' }],
  };
  return (
    <Form onSubmit={(values) => console.log(values)} defaultValues={defaultValues}>
      {({ control, register }) => (
        <div>
          <FieldArray control={control} name="people">
            {({ fields, append }) => (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  {fields.map((field, index) => (
                    <HorizontalGroup key={field.id}>
                      <Input
                        key={field.id}
                        {...register(`people.${index}.firstName` as const)}
                        defaultValue={field.firstName}
                      />
                      <Input
                        key={field.id}
                        {...register(`people.${index}.lastName` as const)}
                        defaultValue={field.lastName}
                      />
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
