import { Controller, useForm } from 'react-hook-form';

import { Button, Field, Input, MultiSelect, RadioButtonGroup, Stack } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { createSecret } from '../state/actions';
import { Secret } from '../types';
import { transformFromSecret } from '../utils';

import { SecretInput } from './SecretInput';

interface FormValues {
  name: string;
  description: string;
  value?: string;
  enabled?: boolean;
  audiences: Array<{ label: string; value: string }>;
}

interface SecretFormProps {
  create?: boolean;
  onSubmit: () => void;
  initialValues?: Partial<Secret>;
}

export function SecretForm({ onSubmit, create = false, initialValues }: SecretFormProps) {
  const dispatch = useDispatch();

  const audiencesValues = initialValues?.audiences
    ? initialValues.audiences.map((audience) => ({ label: audience, value: audience }))
    : [];

  const audiences = [
    { label: 'Grafana', value: 'grafana/grafana' },
    { label: 'k6', value: 'k6/runner' },
    { label: 'Synthetic Monitoring', value: 'sm/runner' },
    ...audiencesValues,
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<FormValues>({
    defaultValues: { ...(initialValues as unknown as FormValues), audiences: audiencesValues },
  });

  const submitText = create ? 'Create' : 'Update';

  return (
    <form
      onSubmit={handleSubmit((data) => {
        dispatch(
          createSecret({
            ...data,
            audiences: data.audiences.map((audience: { value: string }) => audience.value),
          } as Secret)
        ).finally(() => {
          onSubmit();
        });

        // @ts-expect-error just testing
        console.log('data', data, transformFromSecret(data));
      })}
    >
      <Field
        disabled={!create}
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
        <SecretInput isConfigured={!create} {...register('value', { required: create })} />
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
      <Field description="Services able to decrypt secret value." label="Audience">
        <Controller
          control={control}
          name="audiences"
          render={({ field: { ref, ...field } }) => <MultiSelect options={audiences} {...field} />}
        />
      </Field>
      <Stack gap={1} justifyContent="flex-end">
        <Button variant="secondary" onClick={onSubmit}>
          Cancel
        </Button>
        <Button type="submit">{submitText}</Button>
      </Stack>
    </form>
  );
}
