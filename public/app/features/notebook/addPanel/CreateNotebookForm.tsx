import { Controller, useForm } from 'react-hook-form';

import { t, Trans } from '@grafana/i18n';
import { Field, Input, Stack, TagsInput, TextArea } from '@grafana/ui';

export interface CreateNotebookFormValues {
  title: string;
  description: string;
  tags: string[];
}

interface Props {
  /** Lets the shared modal footer submit this form without owning its state. */
  formId: string;
  onSubmit: (values: CreateNotebookFormValues) => void;
  disabled: boolean;
}

export function CreateNotebookForm({ formId, onSubmit, disabled }: Props) {
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<CreateNotebookFormValues>({ defaultValues: { title: '', description: '', tags: [] } });

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('notebooks.add-panel.create-name', 'Notebook name')}
          invalid={Boolean(errors.title)}
          error={errors.title?.message}
        >
          <Input
            {...register('title', {
              required: t('notebooks.add-panel.create-name-required', 'A notebook name is required'),
              // Validated against the trimmed value because that is what gets saved. `required` alone
              // accepts a name of nothing but spaces, which would create a notebook with no title and
              // no complaint.
              validate: (value) =>
                value.trim().length > 0 || t('notebooks.add-panel.create-name-required', 'A notebook name is required'),
            })}
            id="notebook-name"
            disabled={disabled}
            autoFocus
          />
        </Field>

        <Field
          noMargin
          label={t('notebooks.add-panel.create-description', 'Description')}
          description={
            <Trans i18nKey="notebooks.add-panel.create-description-help">Optional context for collaborators</Trans>
          }
        >
          <TextArea
            {...register('description')}
            id="notebook-description"
            disabled={disabled}
            placeholder={t('notebooks.add-panel.create-description-placeholder', 'What are you investigating?')}
          />
        </Field>

        <Field
          noMargin
          label={t('notebooks.add-panel.create-tags', 'Tags')}
          description={
            <Trans i18nKey="notebooks.add-panel.create-tags-help">Optional — used for search and filtering</Trans>
          }
        >
          <Controller
            control={control}
            name="tags"
            render={({ field: { value, onChange } }) => (
              // Deduped and sorted so two spellings of the same tag can't both end up on the notebook.
              <TagsInput
                id="notebook-tags"
                disabled={disabled}
                tags={value}
                onChange={(tags) => onChange(Array.from(new Set(tags)).sort())}
              />
            )}
          />
        </Field>
      </Stack>
    </form>
  );
}
