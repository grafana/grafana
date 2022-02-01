import React, { useCallback, useMemo, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, Field, Form, Input, Modal } from '@grafana/ui';
import { useAsyncFn } from 'react-use';
import { SubmitHandler } from 'react-hook-form';

import appEvents from '../../app_events';
import { createFolder } from 'app/features/manage-dashboards/state/actions';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { SelectedFolder } from './FolderPicker';

interface CreateFolderModalArgs {
  defaultFolderName?: string;
  onFolderChange: (folder: SelectedFolder) => void;
}

const useCreateFolderModal = ({ defaultFolderName, onFolderChange }: CreateFolderModalArgs) => {
  const [showModal, setshowModal] = useState<boolean>(false);

  const openModal = useCallback(() => setshowModal(true), []);
  const closeModal = useCallback(() => setshowModal(false), []);
  const toggleModal = useCallback(() => setshowModal((open) => !open), []);

  const [{ loading }, handleCreateFolder] = useAsyncFn(async (title: string) => {
    const newFolder = await createFolder({ title });
    let folder: SelectedFolder = { value: -1, label: 'Not created' };

    if (newFolder.id > -1) {
      appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
      folder = { value: newFolder.id, label: newFolder.title };
      onFolderChange(folder);
    } else {
      appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
    }

    closeModal();

    return folder;
  }, []);

  const validateFolderName = (folderName: string) =>
    validationSrv
      .validateNewFolderName(folderName)
      .then(() => {
        return true;
      })
      .catch((e) => {
        return e.message;
      });

  interface FormModel {
    folderName: string;
  }

  const handleSubmit: SubmitHandler<FormModel> = useCallback(
    (values) => {
      handleCreateFolder(values.folderName);
    },
    [handleCreateFolder]
  );

  const CreateFolderModal = useMemo(
    () => (
      <Modal isOpen={showModal} title={'New dashboard folder'} onDismiss={closeModal} onClickBackdrop={closeModal}>
        <Form<FormModel> defaultValues={{ folderName: defaultFolderName ?? '' }} onSubmit={handleSubmit}>
          {({ register, errors }) => (
            <>
              <Field
                label="Folder name"
                invalid={!!errors.folderName}
                error={errors.folderName && errors.folderName.message}
              >
                <Input
                  id="folder-name-input"
                  autoFocus
                  {...register('folderName', {
                    required: 'Folder name is required.',
                    validate: async (value: string) => await validateFolderName(value),
                  })}
                />
              </Field>
              <Button type="submit" disabled={loading}>
                Create
              </Button>
            </>
          )}
        </Form>
      </Modal>
    ),
    [showModal, closeModal, defaultFolderName, handleSubmit, loading]
  );

  return {
    CreateFolderModal,
    openModal,
    closeModal,
    toggleModal,
  };
};

export { useCreateFolderModal };
