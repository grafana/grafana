import { Controller, useForm } from 'react-hook-form';

import { Button, Field, Input, MultiSelect, RadioButtonGroup, Stack } from '@grafana/ui';

import { MOCKED_SECRET_AUDIENCES } from '../constants';

import { SecretInput } from './SecretInput';

export interface SecretFormValues {
  name: string;
  description: string;
  value?: string;
  uid?: string;
  enabled?: boolean;
  audiences: Array<{ label: string; value: string }>;
  keeper?: string;
}

interface BaseSecretFormProps {
  onCancel: () => void;
  initialValues?: SecretFormValues;
  onSubmit: (data: SecretFormValues) => void;
  submitText?: string;
  disableNameField?: boolean;
}

export function SecretForm({
  onSubmit,
  onCancel,
  initialValues,
  submitText = 'Save',
  disableNameField = false,
}: BaseSecretFormProps) {
  const audiences = [
    ...MOCKED_SECRET_AUDIENCES.map((audience) => ({ label: audience, value: audience })),
    ...(initialValues?.audiences ?? []),
  ];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
  } = useForm<SecretFormValues>({
    defaultValues: initialValues,
  });

  return (
    <form
      onSubmit={handleSubmit(
        (data) => {
          onSubmit(data);
        },
        (errors) => {
          console.log(errors);
        }
      )}
    >
      <input type="hidden" {...register('uid')} />
      <Field
        disabled={disableNameField}
        description="The name that the secret will be referred to as."
        label="Name"
        invalid={Boolean(errors?.name?.message)}
        error={errors?.name?.message as string}
      >
        <Input {...register('name', { required: true })} />
      </Field>
      <Field
        description="Short description of the secret."
        label="Description"
        invalid={Boolean(errors?.description?.message)}
        error={errors?.description?.message as string}
      >
        <Input {...register('description', { required: true })} />
      </Field>
      <Field
        description="Secret value that will be encrypted."
        label="Value"
        invalid={Boolean(errors?.value?.message)}
        error={errors?.value?.message as string}
      >
        <SecretInput isConfigured={disableNameField} {...register('value', { required: !disableNameField })} />
      </Field>
      <Field label="State" description="State of the secret.">
        <Controller
          defaultValue
          control={control}
          name="enabled"
          render={({ field: { ref, ...field } }) => (
            <RadioButtonGroup
              options={[
                { label: 'Active', value: true },
                { label: 'Inactive', value: false },
              ]}
              {...field}
            />
          )}
        />
      </Field>
      <Field description="Services able to decrypt secret value." label="Decrypters">
        <Controller
          control={control}
          name="audiences"
          render={({ field: { ref, ...field } }) => <MultiSelect allowCustomValue options={audiences} {...field} />}
        />
      </Field>
      <Stack gap={1} justifyContent="flex-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {submitText}
        </Button>
      </Stack>
    </form>
  );
}
