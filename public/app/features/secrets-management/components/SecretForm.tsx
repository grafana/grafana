import { css } from '@emotion/css';
import { ChangeEvent, FormEvent, useState, useEffect, useId } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/';
import { t } from '@grafana/i18n';
import { Button, Field, IconButton, Input, MultiSelect, Stack, useStyles2 } from '@grafana/ui';

import { DECRYPT_ALLOW_LIST_OPTIONS, SECRETS_MAX_LABELS } from '../constants';
import { FieldErrorMap, SecretFormValues } from '../types';
import {
  checkLabelNameAvailability,
  isFieldInvalid,
  onChangeTransformation,
  transformSecretLabel,
  transformSecretName,
  validateSecretDescription,
  validateSecretLabel,
  validateSecretName,
  validateSecretValue,
} from '../utils';

import { SecretValueInput } from './SecretValueInput';

export interface SecretFormProps {
  onCancel: () => void;
  initialValues?: SecretFormValues;
  onSubmit: (data: SecretFormValues) => void;
  submitText: string;
  disableNameField?: boolean;
  externalErrors?: FieldErrorMap;
}

export function SecretForm({
  onSubmit,
  onCancel,
  initialValues,
  submitText,
  disableNameField = false,
  externalErrors,
}: SecretFormProps) {
  // Duplicates are not shown.
  const decrypters = [...DECRYPT_ALLOW_LIST_OPTIONS, ...(initialValues?.decrypters ?? [])];
  const isNew = initialValues?.uid === undefined;
  const [isConfigured, setIsConfigured] = useState(!isNew);
  const styles = useStyles2(getStyles);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    getValues,
    trigger,
    setError,
  } = useForm<SecretFormValues>({
    mode: 'onChange',
    defaultValues: initialValues,
  });

  const {
    fields: labelFields,
    append,
    remove,
  } = useFieldArray<SecretFormValues>({
    control,
    name: 'labels',
  });

  useEffect(() => {
    if (externalErrors) {
      Object.entries(externalErrors).forEach(([field, value]) => {
        //@ts-expect-error `field` is valid
        setError(field, { type: 'custom', ...value });
      });
    }
  }, [setError, externalErrors]);

  const handleResetValue = () => {
    setIsConfigured(false);
  };

  const handleNameOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChangeTransformation(event, transformSecretName, (value) => {
      setValue('name', value);
      trigger('name');
    });
  };

  const maxLabelsReached = getValues('labels')?.length >= SECRETS_MAX_LABELS;

  // field ids
  const nameId = useId();
  const descriptionId = useId();
  const valueId = useId();
  const decryptersId = useId();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('uid')} />
      <Stack direction="column" gap={2}>
        <Field
          disabled={disableNameField}
          description={t('secrets.form.name.description', 'The name will be used to reference the secret')}
          label={t('secrets.form.name.label', 'Name')}
          invalid={isFieldInvalid('name', errors)}
          error={errors?.name?.message}
          required
          htmlFor={nameId}
          noMargin
        >
          <Input
            {...register('name', {
              validate: validateSecretName,
            })}
            onChange={handleNameOnChange}
            id={nameId}
          />
        </Field>

        <Field
          description={t('secrets.form.description.description', 'Short description of the purpose of this secret')}
          label={t('secrets.form.description.label', 'Description')}
          invalid={isFieldInvalid('description', errors)}
          error={errors?.description?.message}
          required
          htmlFor={descriptionId}
          noMargin
        >
          <Input
            {...register('description', {
              validate: validateSecretDescription,
            })}
            id={descriptionId}
          />
        </Field>
        <Field
          description={t('secrets.form.value.description', 'Secret value')}
          label={t('secrets.form.value.label', 'Value')}
          invalid={isFieldInvalid('value', errors)}
          error={errors?.value?.message}
          required
          htmlFor={valueId}
          noMargin
        >
          <SecretValueInput
            isConfigured={isConfigured}
            onReset={handleResetValue}
            {...register('value', {
              validate: validateSecretValue,
            })}
            id={valueId}
          />
        </Field>
        <Field
          description={t('secrets.form.decrypters.description', 'Services able to decrypt secret value')}
          label={t('secrets.form.decrypters.label', 'Decrypters')}
          htmlFor={decryptersId}
          noMargin
        >
          <Controller
            control={control}
            name="decrypters"
            render={({ field: { ref, ...field } }) => (
              <MultiSelect
                placeholder={t('secrets.form.decrypters.placeholder', 'Choose decrypter(s)')}
                options={decrypters}
                {...field}
                inputId={decryptersId}
              />
            )}
          />
        </Field>

        <Field
          description={t('secrets.form.labels.description', 'Labels to categorize the secret')}
          label={t('secrets.form.labels.label', 'Labels')}
          invalid={isFieldInvalid('labels', errors)}
          error={errors?.labels?.message}
          noMargin
        >
          <div>
            {labelFields.map((field, index) => {
              return (
                <div key={field.id} className={styles.labelRow}>
                  <Field
                    htmlFor={`secret-labels.${index}.name`}
                    className={styles.labelField}
                    invalid={!!errors?.labels?.[index]?.name}
                    error={errors?.labels?.[index]?.name?.message}
                    noMargin
                  >
                    <Input
                      id={`secret-labels.${index}.name`}
                      placeholder={t('secrets.form.label-name.placeholder', 'name')}
                      {...register(`labels.${index}.name`, {
                        validate: {
                          checkAvailability: (label, formValues) =>
                            checkLabelNameAvailability(label, index, formValues),
                        },
                      })}
                      onChange={(event: FormEvent<HTMLInputElement>) => {
                        const fieldName: `labels.${number}.name` = `labels.${index}.name`; // as const not allowed
                        onChangeTransformation(event, transformSecretLabel, (value) => setValue(fieldName, value));
                        trigger(fieldName);
                      }}
                    />
                  </Field>
                  <Field
                    htmlFor={`secret-labels.${index}.value`}
                    className={styles.labelField}
                    invalid={!!errors?.labels?.[index]?.value}
                    error={errors?.labels?.[index]?.value?.message}
                    noMargin
                  >
                    <Input
                      id={`secret-labels.${index}.value`}
                      placeholder={t('secrets.form.label-value.placeholder', 'value')}
                      {...register(`labels.${index}.value`, {
                        validate: (value) => validateSecretLabel('value', value),
                      })}
                      onChange={(event: FormEvent<HTMLInputElement>) => {
                        const fieldName: `labels.${number}.value` = `labels.${index}.value`; // as const not allowed
                        onChangeTransformation(event, transformSecretLabel, (value) => setValue(fieldName, value));
                        trigger(fieldName);
                      }}
                    />
                  </Field>
                  <IconButton
                    aria-label={t('secrets.form.labels.actions.aria-label-remove', 'Remove label')}
                    name="minus-circle"
                    onClick={() => remove(index)}
                  />
                </div>
              );
            })}
          </div>
        </Field>
        <div>
          <Button
            size="sm"
            onClick={() => {
              append({ name: '', value: '' });
            }}
            icon="plus"
            variant="secondary"
            disabled={maxLabelsReached}
            tooltip={
              maxLabelsReached
                ? t('secrets.form.labels.error.too-many', 'Maximum number of labels reached (Max: {{maxLabels}})', {
                    maxLabels: SECRETS_MAX_LABELS,
                  })
                : undefined
            }
          >
            {t('secrets.form.labels.actions.add', 'Add label')}
          </Button>
        </div>
      </Stack>

      <Stack gap={1} justifyContent="flex-end">
        <Button variant="secondary" onClick={onCancel}>
          {t('secrets.form.btn-cancel', 'Cancel')}
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {submitText}
        </Button>
      </Stack>
    </form>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    labelRow: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'flex-start',
      '& > button': {
        marginTop: theme.spacing(1),
      },
      '& > div': {
        flex: '1 1 100%',
      },
    }),
    buttons: css({
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: theme.spacing(1),
      gap: theme.spacing(1),
    }),
    labelField: css({
      marginBottom: theme.spacing(1), // same as labelRow gap
    }),
  };
}
