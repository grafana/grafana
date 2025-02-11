import { Modal } from '@grafana/ui';

import { SecretForm } from './SecretForm';

interface CreateSecretModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export function CreateSecretModal({ isOpen, onDismiss }: CreateSecretModalProps) {
  return (
    <Modal title="Create secret" isOpen={isOpen} onDismiss={onDismiss}>
      <SecretForm create onSubmit={onDismiss} />
    </Modal>
  );
}
