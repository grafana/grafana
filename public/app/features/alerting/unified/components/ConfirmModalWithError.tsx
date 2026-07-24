import { type ReactNode, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, type ButtonProps, Modal } from '@grafana/ui';

import { ErrorModal } from './ErrorModal';

export interface ConfirmModalWithErrorProps {
  isOpen: boolean;
  title: string;
  body: ReactNode;
  confirmText?: string;
  confirmingText?: string;
  cancelText?: string;
  confirmVariant?: ButtonProps['variant'];
  isPending: boolean;
  error: unknown | undefined;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const ConfirmModalWithError = ({
  isOpen,
  title,
  body,
  confirmText = t('alerting.common.delete', 'Delete'),
  confirmingText = t('alerting.common.deleting', 'Deleting...'),
  cancelText = t('alerting.common.cancel', 'Cancel'),
  confirmVariant = 'destructive',
  isPending,
  error,
  onConfirm,
  onDismiss,
}: ConfirmModalWithErrorProps) => {
  const handleDismiss = () => {
    if (!isPending) {
      onDismiss();
    }
  };

  if (error !== undefined) {
    return <ErrorModal isOpen={isOpen} onDismiss={onDismiss} error={error} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onDismiss={handleDismiss}
      closeOnBackdropClick={!isPending}
      closeOnEscape={!isPending}
    >
      {body}
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isPending}>
          {cancelText}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isPending}>
          {isPending ? confirmingText : confirmText}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export type UseConfirmModalWithErrorProps = Omit<
  ConfirmModalWithErrorProps,
  'isOpen' | 'isPending' | 'error' | 'onConfirm' | 'onDismiss'
> & {
  onConfirm: () => Promise<unknown>;
};

export const useConfirmModalWithError = ({ onConfirm, ...props }: UseConfirmModalWithErrorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>();

  const closeModal = () => {
    setError(undefined);
    setIsOpen(false);
  };

  const dismissModal = () => {
    if (!isPending) {
      closeModal();
    }
  };

  const confirmModal = async () => {
    setIsPending(true);

    try {
      await onConfirm();
      closeModal();
    } catch (error) {
      setError(error);
    } finally {
      setIsPending(false);
    }
  };

  const showModal = () => {
    setError(undefined);
    setIsOpen(true);
  };

  const modal = (
    <ConfirmModalWithError
      {...props}
      isOpen={isOpen}
      isPending={isPending}
      error={error}
      onConfirm={confirmModal}
      onDismiss={dismissModal}
    />
  );

  return [modal, showModal, isPending] as const;
};
