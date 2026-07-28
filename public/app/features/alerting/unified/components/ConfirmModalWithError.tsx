import { type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, type ButtonProps, Modal, ModalsContext } from '@grafana/ui';

import { ErrorModal } from './ErrorModal';

interface ConfirmModalWithErrorProps {
  title: string;
  body: ReactNode;
  confirmText?: string;
  confirmingText?: string;
  cancelText?: string;
  confirmVariant?: ButtonProps['variant'];
  isPending: boolean;
  error: unknown;
  onConfirm: () => void;
  /**
   * ModalsContextProvider replaces any `onDismiss` prop with its own `hideModal`, so dismissal has to
   * travel back to the hook under a different name to keep the hook's state in sync with the modal slot.
   */
  onClose: () => void;
}

const ConfirmModalWithError = ({
  title,
  body,
  confirmText = t('alerting.common.delete', 'Delete'),
  confirmingText = t('alerting.common.deleting', 'Deleting...'),
  cancelText = t('alerting.common.cancel', 'Cancel'),
  confirmVariant = 'destructive',
  isPending,
  error,
  onConfirm,
  onClose,
}: ConfirmModalWithErrorProps) => {
  if (error !== undefined) {
    return <ErrorModal isOpen onDismiss={onClose} error={error} />;
  }

  return (
    <Modal isOpen title={title} onDismiss={onClose} closeOnBackdropClick={!isPending} closeOnEscape={!isPending}>
      {body}
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          {cancelText}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isPending}>
          {isPending ? confirmingText : confirmText}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

type UseConfirmModalWithErrorProps = Omit<
  ConfirmModalWithErrorProps,
  'isPending' | 'error' | 'onConfirm' | 'onClose'
> & {
  onConfirm: () => Promise<unknown>;
};

type UseConfirmModalWithError = [showConfirmModal: () => void, isPending: boolean];

/**
 * Shows a confirmation modal in the app-level modal root, turning it into an error modal if the
 * confirmed action rejects. Exposes the in-flight state so the caller can disable its trigger.
 */
export const useConfirmModalWithError = ({
  onConfirm,
  ...modalProps
}: UseConfirmModalWithErrorProps): UseConfirmModalWithError => {
  const { showModal, hideModal } = useContext(ModalsContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>();

  // ModalsContextProvider hands out new showModal/hideModal identities on every modal state change, so
  // pushing props into the modal slot from an effect that depends on them would loop forever.
  const latest = useRef({ showModal, hideModal, modalProps, onConfirm });
  useEffect(() => {
    latest.current = { showModal, hideModal, modalProps, onConfirm };
  });

  const handleConfirm = useCallback(async () => {
    setIsPending(true);

    try {
      await latest.current.onConfirm();
      setIsOpen(false);
    } catch (error) {
      setError(error);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    latest.current.showModal(ConfirmModalWithError, {
      ...latest.current.modalProps,
      isPending,
      error,
      onConfirm: handleConfirm,
      onClose: () => {
        if (!isPending) {
          setError(undefined);
          setIsOpen(false);
        }
      },
    });
  }, [isOpen, isPending, error, handleConfirm]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    return () => latest.current.hideModal();
  }, [isOpen]);

  const showConfirmModal = useCallback(() => {
    setError(undefined);
    setIsOpen(true);
  }, []);

  return [showConfirmModal, isPending];
};
