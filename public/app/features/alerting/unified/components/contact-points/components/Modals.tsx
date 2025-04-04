import { useCallback, useMemo, useState } from 'react';

import { Button, Modal, ModalProps } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { stringifyErrorLike } from '../../../utils/misc';

/**
 * This hook controls the delete modal for contact points, showing loading and error states when appropriate
 */
export const useDeleteContactPointModal = (
  handleDelete: ({ name, resourceVersion }: { name: string; resourceVersion?: string }) => Promise<unknown>
) => {
  const [showModal, setShowModal] = useState(false);
  const [contactPoint, setContactPoint] = useState<{ name: string; resourceVersion?: string }>();
  const [error, setError] = useState<unknown | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = useCallback(() => {
    if (isLoading) {
      return;
    }
    setContactPoint(undefined);
    setShowModal(false);
    setError(undefined);
  }, [isLoading]);

  const handleShow = useCallback(({ name, resourceVersion }: { name: string; resourceVersion?: string }) => {
    setContactPoint({ name, resourceVersion });
    setShowModal(true);
    setError(undefined);
  }, []);

  const handleSubmit = useCallback(() => {
    if (contactPoint) {
      setIsLoading(true);
      handleDelete(contactPoint)
        .then(() => setShowModal(false))
        .catch(setError)
        .finally(() => {
          setIsLoading(false);
        });
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
        title={t(
          'alerting.use-delete-contact-point-modal.modal-element.title-delete-contact-point',
          'Delete contact point'
        )}
      >
        <p>
          <Trans i18nKey="alerting.use-delete-contact-point-modal.modal-element.deleting-contact-point-permanently-remove">
            Deleting this contact point will permanently remove it.
          </Trans>
        </p>
        <p>
          <Trans i18nKey="alerting.use-delete-contact-point-modal.modal-element.delete-contact-point">
            Are you sure you want to delete this contact point?
          </Trans>
        </p>

        <Modal.ButtonRow>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Yes, delete contact point'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isLoading}>
            <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    );
  }, [error, handleDismiss, handleSubmit, isLoading, showModal]);

  return [modalElement, handleShow, handleDismiss] as const;
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
    <p>
      <Trans i18nKey="alerting.error-modal.failed-to-update-your-configuration">
        Failed to update your configuration:
      </Trans>
    </p>
    <pre>
      <code>{stringifyErrorLike(error)}</code>
    </pre>
  </Modal>
);
