import { useCallback } from 'react';

import { Modal } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';

import { storeSecret } from '../state/actions';
import { createSelectSecretsManagementSecretByName } from '../state/selectors';
import { secretFormValuesToSecret, secretToSecretFormValues } from '../utils';

import { SecretForm, SecretFormValues } from './SecretForm';

interface EditSecretModalProps {
  name?: string;
  isOpen: boolean;
  onDismiss: () => void;
}

export function EditSecretModal({ isOpen, onDismiss, name }: EditSecretModalProps) {
  const dispatch = useDispatch();
  const secret = useSelector(createSelectSecretsManagementSecretByName(name));
  const isNew = !secret || !secret?.name;
  const initialValues = isNew ? undefined : secretToSecretFormValues(secret);
  const modalTitle = isNew ? 'Create secret' : `Edit secret ${secret.name}`;
  const submitText = isNew ? 'Create' : 'Update';

  const handleSubmit = useCallback(
    async (data: SecretFormValues) => {
      try {
        const secretData = secretFormValuesToSecret(data);
        return await dispatch(storeSecret(secretData));
      } catch (error) {
        return Promise.reject('Unable to store secret');
      } finally {
        onDismiss();
      }
    },
    [dispatch, onDismiss]
  );

  return (
    <Modal title={modalTitle} isOpen={isOpen} onDismiss={onDismiss}>
      <SecretForm
        disableNameField={!isNew}
        submitText={submitText}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={onDismiss}
      />
    </Modal>
  );
}
