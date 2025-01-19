import { Meta, StoryFn } from '@storybook/react';
import { FieldValues } from 'react-hook-form';

import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { FieldArray } from './FieldArray';
import mdx from './FieldArray.mdx';
import { Form } from './Form';

const meta: Meta = {
  title: 'Forms/FieldArray',
  component: FieldArray,
  decorators: [withStoryContainer],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['name', 'keyName', 'control', 'shouldUnregister'],
    },
  },
  argTypes: {
    containerWidth: { control: { type: 'range', min: 100, max: 500, step: 10 } },
    containerHeight: { control: { type: 'range', min: 100, max: 500, step: 10 } },
  },
};

export default meta;

export const Simple: StoryFn = (args) => {
  const defaultValues: FieldValues = {
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
                    <Stack key={field.id}>
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
                    </Stack>
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
Simple.args = {
  containerWidth: 300,
  containerHeight: 0,
  showBoundaries: false,
};
