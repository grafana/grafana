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

/**
 * `owner` identifies the hook instance that put the modal in the modal root, so that instance can tell
 * whether it still owns the slot. It is slot bookkeeping rather than something the modal renders.
 */
type ModalSlotProps = ConfirmModalWithErrorProps & { owner: object };

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
  const { showModal, hideModal, component, props } = useContext(ModalsContext);
  const owner = useRef({}).current;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>();

  // The modal root holds a single modal, so a route change or any other caller can take the slot from
  // us at any time. Ownership is therefore read back from the context instead of tracked separately,
  // which would leave the hook believing it still has a modal on screen.
  const ownsModalSlot = component === ConfirmModalWithError && props.owner === owner;

  // ModalsContextProvider hands out new showModal/hideModal identities on every modal state change, so
  // pushing props into the modal slot from an effect that depends on them would loop forever.
  const latest = useRef({ showModal, hideModal, modalProps, onConfirm, isPending, ownsModalSlot });
  useEffect(() => {
    latest.current = { showModal, hideModal, modalProps, onConfirm, isPending, ownsModalSlot };
  });

  const handleClose = useCallback(() => {
    if (latest.current.isPending) {
      return;
    }

    setError(undefined);
    latest.current.hideModal();
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsPending(true);

    try {
      await latest.current.onConfirm();
      if (latest.current.ownsModalSlot) {
        latest.current.hideModal();
      }
    } catch (error) {
      setError(error);
    } finally {
      setIsPending(false);
    }
  }, []);

  const putInModalSlot = useCallback(
    (state: Pick<ConfirmModalWithErrorProps, 'isPending' | 'error'>) => {
      latest.current.showModal<ModalSlotProps>(ConfirmModalWithError, {
        ...latest.current.modalProps,
        ...state,
        owner,
        onConfirm: handleConfirm,
        onClose: handleClose,
      });
    },
    [owner, handleConfirm, handleClose]
  );

  // Once the slot belongs to somebody else the confirmation is gone from the screen, so its outcome is
  // dropped rather than pushed back over whatever replaced it.
  useEffect(() => {
    if (!latest.current.ownsModalSlot) {
      return;
    }

    putInModalSlot({ isPending, error });
  }, [isPending, error, putInModalSlot]);

  useEffect(
    () => () => {
      if (latest.current.ownsModalSlot) {
        latest.current.hideModal();
      }
    },
    []
  );

  const showConfirmModal = useCallback(() => {
    setError(undefined);
    putInModalSlot({ isPending: false, error: undefined });
  }, [putInModalSlot]);

  return [showConfirmModal, isPending];
};
