import { useCallback } from 'react';

import { Modal, Spinner } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useCreateSecretMutation, useGetSecretQuery, useUpdateSecretMutation } from '../api/secretsManagementApi';
import { SecretFormValues } from '../types';
import { secretFormValuesToSecret, secretToSecretFormValues } from '../utils';

import { SecretForm } from './SecretForm';

interface EditSecretModalProps {
  name?: string;
  isOpen: boolean;
  onDismiss: () => void;
}

export function EditSecretModal({ isOpen, onDismiss, name }: EditSecretModalProps) {
  const {
    data: secret,
    isLoading,
    isUninitialized,
  } = useGetSecretQuery(name as string, {
    skip: !name,
  });

  const [createSecret] = useCreateSecretMutation();
  const [updateSecret] = useUpdateSecretMutation();

  const isNew = isUninitialized;
  const initialValues = isNew ? undefined : secretToSecretFormValues(secret);
  const modalTitle = isNew
    ? t('secrets.edit-modal.title.create', 'Create secret')
    : t('secrets.edit-modal.title.edit', 'Edit secret {{name}}', { name: secret?.name ?? '' });
  const submitText = isNew
    ? t('secrets.edit-modal.form.button-create', 'Create')
    : t('secrets.edit-modal.form.button-update', 'Update');

  const handleSubmit = useCallback(
    async (data: SecretFormValues) => {
      try {
        const secretData = secretFormValuesToSecret({ ...secret, ...data });
        if (isNew) {
          await createSecret(secretData);
        } else {
          await updateSecret(secretData);
        }
      } catch (error) {
        return Promise.reject('Unable to store secret');
      } finally {
        onDismiss();
      }
    },
    [createSecret, isNew, onDismiss, secret, updateSecret]
  );

  return (
    <Modal title={modalTitle} isOpen={isOpen} onDismiss={onDismiss} closeOnBackdropClick={false}>
      {isLoading && <Spinner />}
      {!isLoading && (
        <SecretForm
          disableNameField={!isNew}
          submitText={submitText}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onCancel={onDismiss}
        />
      )}
    </Modal>
  );
}
