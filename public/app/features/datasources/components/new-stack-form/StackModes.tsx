import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, IconButton, Input, Stack, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { StackFormSection } from './StackFormSection';
import { ModeSection, StackFormValues } from './types';

const createEmptyMode = (): ModeSection => ({
  name: '',
  datasources: {},
});

export const StackModes = () => {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<StackFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'modes',
  });

  const templates = watch('templates');

  const hasTemplates = templates && templates.length > 0;

  return (
    <StackFormSection
      stepNo={3}
      title={t('datasources.stack-modes.title', 'Add modes')}
      description={
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="datasources.stack-modes.description">
            Define modes (e.g., dev, staging, prod) and select the actual datasources for each template entry.
          </Trans>
        </Text>
      }
    >
      <Stack direction="column" gap={3}>
        {!hasTemplates && (
          <Text color="secondary" italic>
            <Trans i18nKey="datasources.stack-modes.no-templates">
              Add template sections first to define modes.
            </Trans>
          </Text>
        )}

        {hasTemplates &&
          fields.map((field, index) => (
            <ModeSectionRow
              key={field.id}
              index={index}
              register={register}
              control={control}
              errors={errors}
              templates={templates}
              onRemove={() => remove(index)}
            />
          ))}

        {hasTemplates && (
          <Button type="button" variant="secondary" icon="plus" onClick={() => append(createEmptyMode())}>
            <Trans i18nKey="datasources.stack-modes.add-mode">Add mode</Trans>
          </Button>
        )}
      </Stack>
    </StackFormSection>
  );
};

interface ModeSectionRowProps {
  index: number;
  register: ReturnType<typeof useFormContext<StackFormValues>>['register'];
  control: ReturnType<typeof useFormContext<StackFormValues>>['control'];
  errors: ReturnType<typeof useFormContext<StackFormValues>>['formState']['errors'];
  templates: StackFormValues['templates'];
  onRemove: () => void;
}

const ModeSectionRow = ({ index, register, control, errors, templates, onRemove }: ModeSectionRowProps) => {
  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={2} alignItems="center">
        <Field
          noMargin
          label={t('datasources.stack-modes.mode-name-label', 'Mode name')}
          error={errors?.modes?.[index]?.name?.message}
          invalid={!!errors?.modes?.[index]?.name?.message}
        >
          <Input
            id={`modes.${index}.name`}
            width={30}
            {...register(`modes.${index}.name`, {
              required: {
                value: true,
                message: t('datasources.stack-modes.mode-name-required', 'Mode name is required'),
              },
            })}
            placeholder={t('datasources.stack-modes.mode-name-placeholder', 'e.g. production')}
          />
        </Field>

        <IconButton
          name="trash-alt"
          variant="destructive"
          tooltip={t('datasources.stack-modes.remove-mode', 'Remove mode')}
          onClick={onRemove}
          aria-label={t('datasources.stack-modes.remove-mode', 'Remove mode')}
        />
      </Stack>

      <Stack direction="row" gap={2} wrap="wrap">
        {templates.map((template) => (
          <Field
            noMargin
            key={template.name}
            label={template.name || t('datasources.stack-modes.unnamed-template', 'Unnamed template')}
          >
            <Controller
              name={`modes.${index}.datasources.${template.name}`}
              control={control}
              render={({ field: { ref, onChange, value, ...field } }) => (
                <DataSourcePicker
                  {...field}
                  current={value}
                  onChange={(ds) => onChange(ds.uid)}
                  noDefault={true}
                  pluginId={template.type}
                  placeholder={t('datasources.stack-modes.select-datasource', 'Select datasource')}
                  width={30}
                />
              )}
            />
          </Field>
        ))}
      </Stack>
    </Stack>
  );
};

