import { StoryFn } from '@storybook/react';
import { useId } from 'react';
import { ValidateResult } from 'react-hook-form';

import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { InputControl } from '../InputControl';
import { Select } from '../Select/Select';
import { Switch } from '../Switch/Switch';
import { TextArea } from '../TextArea/TextArea';

import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { Form } from './Form';
import mdx from './Form.mdx';
import { Legend } from './Legend';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';

export default {
  title: 'Forms/Form',
  decorators: [withStoryContainer],
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

const renderForm = (defaultValues?: FormDTO) => {
  const nameId = useId();
  const emailId = useId();
  const usernameId = useId();
  const nestedPathId = useId();
  const textId = useId();
  const checkboxId = useId();
  const switchId = useId();
  const radioId = useId();
  const selectId = useId();
  return (
    <Form
      defaultValues={defaultValues}
      onSubmit={(data: FormDTO) => {
        console.log(data);
      }}
    >
      {({ register, control, errors }) => {
        console.log(errors);
        return (
          <>
            <Legend>Edit user</Legend>

            <Field label="Name" invalid={!!errors.name} error="Name is required">
              <Input {...register('name', { required: true })} placeholder="Roger Waters" id={nameId} />
            </Field>

            <Field label="Email" invalid={!!errors.email} error="E-mail is required">
              <Input {...register('email', { required: true })} id={emailId} placeholder="roger.waters@grafana.com" />
            </Field>

            <Field label="Username">
              <Input {...register('username')} placeholder="mr.waters" id={usernameId} />
            </Field>
            <Field label="Nested object">
              <Input {...register('nested.path')} placeholder="Nested path" id={nestedPathId} />
            </Field>

            <Field label="Textarea" invalid={!!errors.text} error="Text is required">
              <TextArea {...register('text', { required: true })} placeholder="Long text" id={textId} />
            </Field>

            <Field label="Checkbox" invalid={!!errors.checkbox} error="We need your consent">
              <Checkbox {...register('checkbox', { required: true })} label="Do you consent?" id={checkboxId} />
            </Field>

            <Field label="Switch">
              <Switch name="switch" {...register} id={switchId} />
            </Field>

            <Field label="RadioButton" htmlFor={radioId}>
              <InputControl
                name="radio"
                control={control}
                render={({ field }) => <RadioButtonGroup {...field} options={selectOptions} id={radioId} />}
              />
            </Field>

            <Field label="Select" invalid={!!errors.select} error="Select is required" htmlFor={selectId}>
              <InputControl
                name="select"
                control={control}
                rules={{
                  required: true,
                }}
                render={({ field }) => <Select {...field} options={selectOptions} inputId={selectId} />}
              />
            </Field>

            <Button type="submit">Update</Button>
          </>
        );
      }}
    </Form>
  );
};

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

export const AsyncValidation: StoryFn = ({ passAsyncValidation }) => {
  return (
    <>
      <Form
        onSubmit={(data: FormDTO) => {
          alert('Submitted successfully!');
        }}
      >
        {({ register, control, errors, formState }) => {
          console.log(errors);
          return (
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
          );
        }}
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
