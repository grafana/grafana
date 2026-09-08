import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';

import { t, Trans } from '@grafana/i18n';
import { Field, Input, MultiCombobox, Stack, TextArea } from '@grafana/ui';

import { useNotebookTagOptions } from '../scene/layout-notebook/useNotebookTagOptions';

import { type AddPanelFormValues } from './addPanelForm';

interface Props {
  control: Control<AddPanelFormValues>;
  register: UseFormRegister<AddPanelFormValues>;
  errors: FieldErrors<AddPanelFormValues>;
  /**
   * The titles already in use, to refuse a duplicate the way saving a dashboard does.
   *
   * Best effort, and deliberately so: the apiserver has no uniqueness constraint on a notebook title
   * to fall back on, so this can only compare against the notebooks the picker has loaded. A library
   * past the search's accumulation ceiling, or one narrowed by an active filter, can still let a
   * duplicate through - which is what happens today regardless.
   */
  existingTitles: string[];
  disabled: boolean;
}

/**
 * The fields for a notebook that does not exist yet.
 *
 * Fields rather than a form of its own: the modal owns one react-hook-form covering both routes, so
 * there is a single submit path that decides what to write from the values it is handed.
 */
export function CreateNotebookFields({ control, register, errors, existingTitles, disabled }: Props) {
  const takenTitles = new Set(existingTitles.map((title) => title.trim().toLowerCase()));

  return (
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
            validate: {
              // Validated against the trimmed value because that is what gets saved. `required` alone
              // accepts a name of nothing but spaces, which would create a notebook with no title and
              // no complaint.
              notBlank: (value) =>
                value.trim().length > 0 || t('notebooks.add-panel.create-name-required', 'A notebook name is required'),
              // Compared case-insensitively: two notebooks differing only in case read as the same
              // one in a list, which is the confusion this is here to prevent.
              notTaken: (value) =>
                !takenTitles.has(value.trim().toLowerCase()) ||
                t('notebooks.add-panel.create-name-taken', 'A notebook with this name already exists'),
            },
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
        // Stated rather than inferred: Field reads the id off its first child, which here is the
        // Controller rather than the input, so without this the label names nothing.
        htmlFor="notebook-tags"
        label={t('notebooks.add-panel.create-tags', 'Tags')}
        description={
          <Trans i18nKey="notebooks.add-panel.create-tags-help">Optional — used for search and filtering</Trans>
        }
      >
        <Controller
          control={control}
          name="tags"
          render={({ field: { value, onChange } }) => (
            <NotebookTagsField value={value} onChange={onChange} disabled={disabled} />
          )}
        />
      </Field>
    </Stack>
  );
}

/**
 * The same picker the document header offers, so a tag is chosen from the ones already in use rather
 * than retyped from memory.
 *
 * The options hook is reused rather than `NotebookTagPicker` itself: that component strips its own
 * border, background and focus ring to sit inline on the page, which inside a `Field` would read as a
 * broken input.
 */
function NotebookTagsField({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled: boolean;
}) {
  const options = useNotebookTagOptions(value);

  return (
    <MultiCombobox
      id="notebook-tags"
      disabled={disabled}
      options={options}
      value={value}
      // Deduped, trimmed and sorted so two spellings of the same tag cannot both end up on the
      // notebook. A custom value arrives as the raw string typed, spaces and all.
      onChange={(selected) =>
        onChange(Array.from(new Set(selected.map((option) => option.value.trim()).filter(Boolean))).sort())
      }
      createCustomValue
      customValueDescription={t('notebooks.add-panel.create-tags-custom-value', 'Add as a new tag')}
      placeholder={t('notebooks.add-panel.create-tags-placeholder', 'Add a tag')}
    />
  );
}
