import { type FieldErrors, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

import { type AddPanelFormValues } from './addPanelForm';

interface Props {
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
 *
 * Only the name. The modal is about capturing a panel, and a notebook's tags are edited from its own
 * header once it is open — while a description has nowhere in the notebook to be read back.
 */
export function CreateNotebookFields({ register, errors, existingTitles, disabled }: Props) {
  const takenTitles = new Set(existingTitles.map((title) => title.trim().toLowerCase()));

  return (
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
  );
}
