import { useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Input, Field, Stack } from '@grafana/ui';
import { FolderDTO } from 'app/types/folders';

import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';

interface Props {
  onConfirm: (folderName: string) => void;
  onCancel: () => void;
  parentFolder?: FolderDTO;
}

interface FormModel {
  folderName: string;
}

const initialFormModel: FormModel = { folderName: '' };

export function NewFolderForm({ onCancel, onConfirm, parentFolder }: Props) {
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<FormModel>({ defaultValues: initialFormModel });

  const translatedFolderNameRequiredPhrase = t(
    'browse-dashboards.action.new-folder-name-required-phrase',
    'Folder name is required.'
  );

  const fieldNameLabel = t('browse-dashboards.new-folder-form.name-label', 'Folder name');

  return (
    <form
      name="addFolder"
      onSubmit={handleSubmit((form) => onConfirm(form.folderName))}
      data-testid={selectors.pages.BrowseDashboards.NewFolderForm.form}
    >
      <Field
        label={fieldNameLabel}
        invalid={!!errors.folderName}
        error={errors.folderName && errors.folderName.message}
      >
        <Input
          data-testid={selectors.pages.BrowseDashboards.NewFolderForm.nameInput}
          id="folder-name-input"
          defaultValue={initialFormModel.folderName}
          {...register('folderName', {
            required: translatedFolderNameRequiredPhrase,
            validate: async (v) => await validateFolderName(v, parentFolder?.uid),
          })}
        />
      </Field>
      <Stack>
        <Button variant="secondary" fill="outline" onClick={onCancel}>
          <Trans i18nKey="browse-dashboards.new-folder-form.cancel-label">Cancel</Trans>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Trans i18nKey="browse-dashboards.new-folder-form.create-label">Create</Trans>
        </Button>
      </Stack>
    </form>
  );
}

export async function validateFolderName(folderName: string, parentFolderUid?: string) {
  try {
    await validationSrv.validateNewFolderName(folderName, parentFolderUid);
    return true;
  } catch (e) {
    if (e instanceof Error) {
      return e.message;
    } else {
      throw e;
    }
  }
}
