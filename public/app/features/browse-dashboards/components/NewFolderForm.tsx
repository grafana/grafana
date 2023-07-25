import React from 'react';

import { Button, Input, Form, Field, HorizontalGroup } from '@grafana/ui';
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
    <Form defaultValues={initialFormModel} onSubmit={(form: FormModel) => onConfirm(form.folderName)}>
      {({ register, errors }) => (
        <>
          <Field
            label={fieldNameLabel}
            invalid={!!errors.folderName}
            error={errors.folderName && errors.folderName.message}
          >
            <Input
              id="folder-name-input"
              {...register('folderName', {
                required: translatedFolderNameRequiredPhrase,
                validate: async (v) => await validateFolderName(v),
              })}
            />
          </Field>
          <HorizontalGroup>
            <Button variant="secondary" fill="outline" onClick={onCancel}>
              <Trans i18nKey="browse-dashboards.new-folder-form.cancel-label">Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans i18nKey="browse-dashboards.new-folder-form.create-label">Create</Trans>
            </Button>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
}
