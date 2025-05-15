import { useCallback } from 'react';

import { Modal } from '@grafana/ui';

import { useGetSecretQuery } from '../api/secretsManagementApi';
import { secretFormValuesToSecret, secretToSecretFormValues } from '../utils';

import { SecretForm, SecretFormValues } from './SecretForm';

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

  console.log('isLoading', isLoading, secret);
  const isNew = isUninitialized;
  const initialValues = isNew ? undefined : secretToSecretFormValues(secret);
  const modalTitle = isNew ? 'Create secret' : `Edit secret ${secret?.name}`;
  const submitText = isNew ? 'Create' : 'Update';

  const handleSubmit = useCallback(
    async (data: SecretFormValues) => {
      try {
        const secretData = secretFormValuesToSecret(data);
        console.log('secretData', secretData);
      } catch (error) {
        return Promise.reject('Unable to store secret');
      } finally {
        onDismiss();
      }
    },
    [onDismiss]
  );

  return (
    <Modal title={modalTitle} isOpen={isOpen} onDismiss={onDismiss} closeOnBackdropClick={false}>
      {isLoading && <div>Loading...</div>}
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
