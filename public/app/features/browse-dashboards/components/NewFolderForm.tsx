import React from 'react';

import { Button, Input, Form, Field, HorizontalGroup } from '@grafana/ui';

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

  return (
    <Form defaultValues={initialFormModel} onSubmit={(form: FormModel) => onConfirm(form.folderName)}>
      {({ register, errors }) => (
        <>
          <Field
            label="Folder name"
            invalid={!!errors.folderName}
            error={errors.folderName && errors.folderName.message}
          >
            <Input
              id="folder-name-input"
              {...register('folderName', {
                required: 'Folder name is required.',
                validate: async (v) => await validateFolderName(v),
              })}
            />
          </Field>
          <HorizontalGroup>
            <Button variant="secondary" fill="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
}
