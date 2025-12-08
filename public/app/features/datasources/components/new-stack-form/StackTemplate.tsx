import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, IconButton, Input, Stack, Text } from '@grafana/ui';
import { getOptionDataSourceTypes } from 'app/features/dashboard-scene/settings/variables/utils';

import { StackFormSection } from './StackFormSection';
import { StackFormValues, TemplateSection } from './types';

const emptyTemplateSection: TemplateSection = {
  name: '',
  type: '',
};

export const StackTemplate = () => {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<StackFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'templates',
  });

  return (
    <StackFormSection
      stepNo={2}
      title={t('datasources.stack-template.title', 'Add template sections')}
      description={
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="datasources.stack-template.description">
            Add which datasource types comprise your stack and add names to reference them in the query editor.
          </Trans>
        </Text>
      }
    >
      <Stack direction="column" gap={2}>
        {fields.map((field, index) => (
          <TemplateSectionRow
            key={field.id}
            index={index}
            register={register}
            control={control}
            errors={errors}
            onRemove={() => remove(index)}
          />
        ))}

        <Button type="button" variant="secondary" icon="plus" onClick={() => append(emptyTemplateSection)}>
          <Trans i18nKey="datasources.stack-template.add-section">Add datasource</Trans>
        </Button>
      </Stack>
    </StackFormSection>
  );
};

interface TemplateSectionRowProps {
  index: number;
  register: ReturnType<typeof useFormContext<StackFormValues>>['register'];
  control: ReturnType<typeof useFormContext<StackFormValues>>['control'];
  errors: ReturnType<typeof useFormContext<StackFormValues>>['formState']['errors'];
  onRemove: () => void;
}

const TemplateSectionRow = ({ index, register, control, errors, onRemove }: TemplateSectionRowProps) => {
  const dataSourceOptions = getOptionDataSourceTypes();

  return (
    <Stack direction="row" gap={2} alignItems="flex-start">
      <Field
        noMargin
        label={t('datasources.stack-template.name-label', 'Name')}
        error={errors?.templates?.[index]?.name?.message}
        invalid={!!errors?.templates?.[index]?.name?.message}
      >
        <Input
          id={`templates.${index}.name`}
          width={30}
          {...register(`templates.${index}.name`, {
            required: {
              value: true,
              message: t('datasources.stack-template.name-required', 'Name is required'),
            },
          })}
          placeholder={t('datasources.stack-template.name-placeholder', 'e.g. logs-datasource')}
        />
      </Field>

      <Field
        noMargin
        label={t('datasources.stack-template.type-label', 'Data source type')}
        error={errors?.templates?.[index]?.type?.message}
        invalid={!!errors?.templates?.[index]?.type?.message}
      >
        <Controller
          name={`templates.${index}.type`}
          control={control}
          rules={{
            required: {
              value: true,
              message: t('datasources.stack-template.type-required', 'Type is required'),
            },
          }}
          render={({ field: { ref, onChange, ...field } }) => (
            <Combobox
              id={`templates.${index}.type`}
              width={30}
              options={dataSourceOptions}
              onChange={(option) => onChange(option?.value || '')}
              placeholder={t('datasources.stack-template.type-placeholder', 'Select type')}
              {...field}
            />
          )}
        />
      </Field>

      <IconButton
        name="trash-alt"
        variant="destructive"
        tooltip={t('datasources.stack-template.remove-section', 'Remove section')}
        onClick={onRemove}
        aria-label={t('datasources.stack-template.remove-section', 'Remove section')}
        style={{ marginTop: '28px' }}
      />
    </Stack>
  );
};
