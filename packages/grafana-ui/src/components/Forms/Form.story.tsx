import React, { useState } from 'react';
import { Legend } from './Legend';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Field } from './Field';
import { Input } from './Input/Input';
import { Button } from './Button';
import { Form } from './Form';
import { Switch } from './Switch';
import { Checkbox } from './Checkbox';

import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';
import { Select } from './Select/Select';
import Forms from './index';
import mdx from './Form.mdx';
import { boolean } from '@storybook/addon-knobs';
import { TextArea } from './TextArea/TextArea';

export default {
  title: 'Forms/Test forms',
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
  name: string;
  email: string;
  username: string;
  checkbox: boolean;
  switch: boolean;
  radio: string;
  select: string;
  text: string;
  nested: {
    path: string;
  };
}

const renderForm = (defaultValues?: Partial<FormDTO>) => (
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
            <Input name="name" placeholder="Roger Waters" size="md" ref={register({ required: true })} />
          </Field>

          <Field label="Email" invalid={!!errors.email} error="E-mail is required">
            <Input
              id="email"
              name="email"
              placeholder="roger.waters@grafana.com"
              size="md"
              ref={register({ required: true })}
            />
          </Field>

          <Field label="Username">
            <Input name="username" placeholder="mr.waters" size="md" ref={register} />
          </Field>
          <Field label="Nested object">
            <Input name="nested.path" placeholder="Nested path" size="md" ref={register} />
          </Field>

          <Field label="Textarea" invalid={!!errors.text} error="Text is required">
            <TextArea name="text" placeholder="Long text" size="md" ref={register({ required: true })} />
          </Field>

          <Field label="Checkbox" invalid={!!errors.checkbox} error="We need your consent">
            <Checkbox name="checkbox" label="Do you consent?" ref={register({ required: true })} />
          </Field>

          <Field label="Switch">
            <Switch name="switch" ref={register} />
          </Field>

          <Field label="RadioButton">
            <Forms.InputControl name="radio" control={control} options={selectOptions} as={RadioButtonGroup} />
          </Field>

          <Field label="Select" invalid={!!errors.select} error="Select is required">
            <Forms.InputControl
              name="select"
              control={control}
              rules={{
                required: true,
              }}
              options={selectOptions}
              as={Select}
            />
          </Field>

          <Button type="submit">Update</Button>
        </>
      )
    }
  </Form>
);

export const basic = () => {
  return <>{renderForm()}</>;
};

export const defaultValues = () => {
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
    {
      name: 'John Waters',
      nested: {
        path: 'Nested path default value updated',
      },
      radio: 'option1',
      select: 'option2',
      switch: false,
    },
  ];
  const [defaultsIdx, setDefaultsIdx] = useState(0);

  return (
    <>
      {renderForm(defaultValues[defaultsIdx])}
      <Button
        onClick={() => {
          setDefaultsIdx(s => (s + 1) % 2);
        }}
        variant="secondary"
      >
        Change default values
      </Button>
    </>
  );
};
