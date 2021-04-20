import { Button, ButtonGroup, Field, Input, TextArea } from '@grafana/ui';
import React, { FC } from 'react';
import { useForm } from 'react-hook-form';

interface Values {
  name: string;
  content: string;
}

const defaultValues: Values = Object.freeze({
  name: '',
  content: '',
});

interface Props {
  defaults?: Values;
}

export const TemplateForm: FC<Props> = ({ defaults = defaultValues }) => {
  const submit = (values: Values) => {
    console.log('submit', values);
  };

  const { handleSubmit, register, errors } = useForm<Values>({
    mode: 'onSubmit',
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Field label="Template name" error={errors?.name?.message} invalid={!!errors.name?.message}>
        <Input autoFocus={true} ref={register({ required: { value: true, message: 'Required.' } })} name="name" />
      </Field>
      <Field label="Content" error={errors?.name?.message} invalid={!!errors.name?.message}>
        <TextArea autoFocus={true} ref={register({ required: { value: true, message: 'Required.' } })} name="name" />
      </Field>
      <ButtonGroup>
        <Button variant="primary">Save template</Button>
        <Button variant="secondary" type="button">
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  );
};
