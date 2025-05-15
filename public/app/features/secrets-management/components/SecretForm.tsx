import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Field, Input, MultiSelect, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DECRYPT_ALLOW_LIST_OPTIONS } from '../constants';
import { validateSecretDescription, validateSecretName, validateSecretValue } from '../utils';

import { SecretValueInput } from './SecretValueInput';

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
  submitText: string;
  disableNameField?: boolean;
}

export function SecretForm({
  onSubmit,
  onCancel,
  initialValues,
  submitText,
  disableNameField = false,
}: BaseSecretFormProps) {
  // Duplicates are not shown.
  const audiences = [...DECRYPT_ALLOW_LIST_OPTIONS, ...(initialValues?.audiences ?? [])];
  const isNew = initialValues?.uid === undefined;
  const [isConfigured, setIsConfigured] = useState(!isNew);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
  } = useForm<SecretFormValues>({
    defaultValues: initialValues,
  });

  const handleResetValue = () => {
    setIsConfigured(false);
  };

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
        description={t('secrets-management.form.name.description', 'The name will be used to reference the secret')}
        label={t('secrets-management.form.name.label', 'Name')}
        invalid={Boolean(errors?.name?.message)}
        error={errors?.name?.message as string}
        required
      >
        <Input
          {...register('name', {
            validate: validateSecretName,
          })}
        />
      </Field>
      <Field
        description={t(
          'secrets-management.form.description.description',
          'Short description of the purpose of this secret'
        )}
        label={t('secrets-management.form.description.label', 'Description')}
        invalid={Boolean(errors?.description?.message)}
        error={errors?.description?.message as string}
        required
      >
        <Input
          {...register('description', {
            validate: validateSecretDescription,
          })}
        />
      </Field>
      <Field
        description={t('secrets-management.form.value.description', 'Secret value')}
        label={t('secrets-management.form.value.label', 'Value')}
        invalid={Boolean(errors?.value?.message)}
        error={errors?.value?.message as string}
        required
      >
        <SecretValueInput
          isConfigured={isConfigured}
          onReset={handleResetValue}
          {...register('value', {
            validate: validateSecretValue,
          })}
        />
      </Field>
      <Field
        description={t('secrets-management.form.decrypters.description', 'Services able to decrypt secret value')}
        label={t('secrets-management.form.decrypters.label', 'Decrypters')}
      >
        <Controller
          control={control}
          name="audiences"
          render={({ field: { ref, ...field } }) => (
            <MultiSelect
              placeholder={t('secrets-management.form.decrypters.placeholder', 'Choose decrypter(s)')}
              options={audiences}
              {...field}
            />
          )}
        />
      </Field>
      <Stack gap={1} justifyContent="flex-end">
        <Button variant="secondary" onClick={onCancel}>
          {t('secrets-management.form.btn-cancel', 'Cancel')}
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {submitText}
        </Button>
      </Stack>
    </form>
  );
}
