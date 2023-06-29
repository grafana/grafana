import React, { FC, useCallback, useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Modal, ModalProps, Spinner } from '@grafana/ui';

type ModalHook<T = undefined> = [JSX.Element, (item: T) => void, () => void];

export const useDeleteContactPointModal = (
  handleDelete: (name: string) => void,
  loading: boolean
): ModalHook<string> => {
  const [showModal, setShowModal] = useState(false);
  const [contactPoint, setContactPoint] = useState<string>();

  const handleDismiss = useCallback(() => {
    setContactPoint(undefined);
    setShowModal(false);
  }, [setContactPoint]);

  const handleShow = useCallback((name: string) => {
    setContactPoint(name);
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (contactPoint) {
      handleDelete(contactPoint);
    }
  }, [handleDelete, contactPoint]);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Delete contact point"
        >
          <p>Deleting this contact point will permanently remove it.</p>
          <p>Are you sure you want to delete this contact point?</p>

          <Modal.ButtonRow>
            <Button type="button" variant="destructive" onClick={handleSubmit}>
              Yes, delete contact point
            </Button>
            <Button type="button" variant="secondary" onClick={handleDismiss}>
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>
      ),
    [handleDismiss, handleSubmit, loading, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const UpdatingModal: FC<Pick<ModalProps, 'isOpen'>> = ({ isOpen }) => (
  <Modal
    isOpen={isOpen}
    onDismiss={() => {}}
    closeOnBackdropClick={false}
    closeOnEscape={false}
    title={
      <Stack direction="row" alignItems="center" gap={0.5}>
        Updating... <Spinner inline />
      </Stack>
    }
  >
    Please wait while we update your configuration.
  </Modal>
);
