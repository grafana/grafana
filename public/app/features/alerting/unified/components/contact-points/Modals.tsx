import React, { useCallback, useMemo, useState } from 'react';

import { Button, Modal, ModalProps } from '@grafana/ui';

type ModalHook<T = undefined> = [JSX.Element, (item: T) => void, () => void];

/**
 * This hook controls the delete modal for contact points, showing loading and error states when appropriate
 */
export const useDeleteContactPointModal = (
  handleDelete: (name: string) => Promise<void>,
  isLoading: boolean
): ModalHook<string> => {
  const [showModal, setShowModal] = useState(false);
  const [contactPoint, setContactPoint] = useState<string>();
  const [error, setError] = useState<unknown | undefined>();

  const handleDismiss = useCallback(() => {
    if (isLoading) {
      return;
    }

    setContactPoint(undefined);
    setShowModal(false);
    setError(undefined);
  }, [isLoading]);

  const handleShow = useCallback((name: string) => {
    setContactPoint(name);
    setShowModal(true);
    setError(undefined);
  }, []);

  const handleSubmit = useCallback(() => {
    if (contactPoint) {
      handleDelete(contactPoint)
        .then(() => setShowModal(false))
        .catch(setError);
    }
  }, [handleDelete, contactPoint]);

  const modalElement = useMemo(() => {
    if (error) {
      return <ErrorModal isOpen={showModal} onDismiss={handleDismiss} error={error} />;
    }

    return (
      <Modal
        isOpen={showModal}
        onDismiss={handleDismiss}
        closeOnBackdropClick={!isLoading}
        closeOnEscape={!isLoading}
        title="Delete contact point"
      >
        <p>Deleting this contact point will permanently remove it.</p>
        <p>Are you sure you want to delete this contact point?</p>

        <Modal.ButtonRow>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Yes, delete contact point'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isLoading}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>
    );
  }, [error, handleDismiss, handleSubmit, isLoading, showModal]);

  return [modalElement, handleShow, handleDismiss];
};

interface ErrorModalProps extends Pick<ModalProps, 'isOpen' | 'onDismiss'> {
  error: unknown;
}
const ErrorModal = ({ isOpen, onDismiss, error }: ErrorModalProps) => (
  <Modal
    isOpen={isOpen}
    onDismiss={onDismiss}
    closeOnBackdropClick={true}
    closeOnEscape={true}
    title={'Something went wrong'}
  >
    <p>Failed to update your configuration:</p>
    <p>
      <code>{String(error)}</code>
    </p>
  </Modal>
);
