import { Modal } from '@grafana/ui';
import { useSelector } from 'app/types';

import { createSelectSecretsManagementSecretByName } from '../state/selectors';

import { SecretForm } from './SecretForm';

interface EditSecretModalProps {
  name: string;
  isOpen: boolean;
  onDismiss: () => void;
}

export function EditSecretModal({ isOpen, onDismiss, name }: EditSecretModalProps) {
  const secret = useSelector(createSelectSecretsManagementSecretByName(name));
  if (!secret) {
    return null;
  }

  return (
    <Modal title="Edit secret" isOpen={isOpen} onDismiss={onDismiss}>
      <SecretForm initialValues={secret} onSubmit={onDismiss} />
    </Modal>
  );
}
