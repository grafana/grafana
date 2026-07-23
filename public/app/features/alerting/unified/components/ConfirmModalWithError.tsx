import { noop } from 'lodash';
import { type ReactNode, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, type ButtonProps, Modal } from '@grafana/ui';

import { type AsyncState, isError, isLoading } from '../hooks/useAsync';

import { ErrorModal } from './ErrorModal';

export interface ConfirmModalWithErrorProps {
  isOpen: boolean;
  title: string;
  body: ReactNode;
  confirmText?: string;
  confirmingText?: string;
  cancelText?: string;
  confirmVariant?: ButtonProps['variant'];
  state: AsyncState<unknown>;
  onConfirm: () => Promise<unknown>;
  onDismiss: () => void;
  /** Called alongside `onDismiss` to clear the error state once the user acknowledges it. */
  onReset: () => void;
}

export const ConfirmModalWithError = ({
  isOpen,
  title,
  body,
  confirmText = t('alerting.common.delete', 'Delete'),
  confirmingText = t('alerting.common.deleting', 'Deleting...'),
  cancelText = t('alerting.common.cancel', 'Cancel'),
  confirmVariant = 'destructive',
  state,
  onConfirm,
  onDismiss,
  onReset,
}: ConfirmModalWithErrorProps) => {
  const isRunning = isLoading(state);

  const handleDismiss = isRunning ? noop : onDismiss;

  const handleConfirm = async () => {
    onConfirm().then(() => handleDismiss());
  };

  const handleErrorDismiss = () => {
    onReset();
    onDismiss();
  };

  if (isError(state)) {
    return <ErrorModal isOpen onDismiss={handleErrorDismiss} error={state.error} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onDismiss={handleDismiss}
      closeOnBackdropClick={!isRunning}
      closeOnEscape={!isRunning}
    >
      <p>{body}</p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isRunning}>
          {cancelText}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={handleConfirm} disabled={isRunning}>
          {isRunning ? (confirmingText ?? confirmText) : confirmText}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export type UseConfirmModalWithErrorProps = Omit<ConfirmModalWithErrorProps, 'isOpen' | 'onDismiss'>;

/**
 * Owns the open/closed state for `ConfirmModalWithError` so callers don't have to.
 */
export const useConfirmModalWithError = (props: UseConfirmModalWithErrorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const showModal = () => setIsOpen(true);
  const dismissModal = () => setIsOpen(false);

  const modal = <ConfirmModalWithError {...props} isOpen={isOpen} onDismiss={dismissModal} />;

  return [modal, showModal, props.state] as const;
};
