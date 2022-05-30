import { Story } from '@storybook/react';
import React from 'react';
import { ValidateResult } from 'react-hook-form';

import {
  Field,
  Legend,
  Input,
  Button,
  Form,
  Switch,
  Checkbox,
  Select,
  InputControl,
  TextArea,
  RadioButtonGroup,
} from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';

import mdx from './Form.mdx';

export default {
  title: 'Forms/Form',
  decorators: [withStoryContainer, withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const selectOptions = [
  {
    label: 'Option 1',
    value: 'option1',
  },
  {
    label: 'Option 2',
    value: 'option2',
  },
  {
    label: 'Option 3',
    value: 'option3',
  },
];

interface FormDTO {
  name?: string;
  email?: string;
  username?: string;
  checkbox?: boolean;
  switch: boolean;
  radio: string;
  select: string;
  text?: string;
  nested: {
    path: string;
  };
}

const renderForm = (defaultValues?: FormDTO) => (
  <Form
    defaultValues={defaultValues}
    onSubmit={(data: FormDTO) => {
      console.log(data);
    }}
  >
    {({ register, control, errors }) =>
      (console.log(errors) as any) || (
        <>
          <Legend>Edit user</Legend>

          <Field label="Name" invalid={!!errors.name} error="Name is required">
            <Input {...register('name', { required: true })} placeholder="Roger Waters" />
          </Field>

          <Field label="Email" invalid={!!errors.email} error="E-mail is required">
            <Input {...register('email', { required: true })} id="email" placeholder="roger.waters@grafana.com" />
          </Field>

          <Field label="Username">
            <Input {...register('username')} placeholder="mr.waters" />
          </Field>
          <Field label="Nested object">
            <Input {...register('nested.path')} placeholder="Nested path" />
          </Field>

          <Field label="Textarea" invalid={!!errors.text} error="Text is required">
            <TextArea {...register('text', { required: true })} placeholder="Long text" />
          </Field>

          <Field label="Checkbox" invalid={!!errors.checkbox} error="We need your consent">
            <Checkbox {...register('checkbox', { required: true })} label="Do you consent?" />
          </Field>

          <Field label="Switch">
            <Switch name="switch" {...register} />
          </Field>

          <Field label="RadioButton">
            <InputControl
              name="radio"
              control={control}
              render={({ field }) => <RadioButtonGroup {...field} options={selectOptions} />}
            />
          </Field>

          <Field label="Select" invalid={!!errors.select} error="Select is required">
            <InputControl
              name="select"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field }) => <Select {...field} options={selectOptions} />}
            />
          </Field>

          <Button type="submit">Update</Button>
        </>
      )
    }
  </Form>
);

export const Basic = () => {
  return <>{renderForm()}</>;
};

export const DefaultValues = () => {
  const defaultValues = [
    {
      name: 'Roger Waters',
      nested: {
        path: 'Nested path default value',
      },
      radio: 'option2',
      select: 'option1',
      switch: true,
    },
  ];

  return <>{renderForm(defaultValues[0])}</>;
};

export const AsyncValidation: Story = ({ passAsyncValidation }) => {
  return (
    <>
      <Form
        onSubmit={(data: FormDTO) => {
          alert('Submitted successfully!');
        }}
      >
        {({ register, control, errors, formState }) =>
          (console.log(errors) as any) || (
            <>
              <Legend>Edit user</Legend>

              <Field label="Name" invalid={!!errors.name} error="Username is already taken">
                <Input
                  placeholder="Roger Waters"
                  {...register('name', { validate: validateAsync(passAsyncValidation) })}
                />
              </Field>

              <Button type="submit" disabled={formState.isSubmitting}>
                Submit
              </Button>
            </>
          )
        }
      </Form>
    </>
  );
};
AsyncValidation.args = {
  passAsyncValidation: true,
};

const validateAsync = (shouldPass: boolean) => async () => {
  try {
    await new Promise<ValidateResult | void>((resolve, reject) => {
      setTimeout(() => {
        if (shouldPass) {
          resolve();
        } else {
          reject('Something went wrong...');
        }
      }, 2000);
    });
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};
