import { useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Field, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';

interface Props {
  onConfirm: (folderName: string) => void;
  onCancel: () => void;
}

interface FormModel {
  folderName: string;
}

const initialFormModel: FormModel = { folderName: '' };

export function NewFolderForm({ onCancel, onConfirm }: Props) {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormModel>({ defaultValues: initialFormModel });

  const translatedFolderNameRequiredPhrase = t(
    'browse-dashboards.action.new-folder-name-required-phrase',
    'Folder name is required.'
  );
  const validateFolderName = async (folderName: string) => {
    try {
      await validationSrv.validateNewFolderName(folderName);
      return true;
    } catch (e) {
      if (e instanceof Error) {
        return e.message;
      } else {
        throw e;
      }
    }
  };

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
            validate: async (v) => await validateFolderName(v),
          })}
        />
      </Field>
      <Stack>
        <Button variant="secondary" fill="outline" onClick={onCancel}>
          <Trans i18nKey="browse-dashboards.new-folder-form.cancel-label">Cancel</Trans>
        </Button>
        <Button type="submit">
          <Trans i18nKey="browse-dashboards.new-folder-form.create-label">Create</Trans>
        </Button>
      </Stack>
    </form>
  );
}
