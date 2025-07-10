import { useCallback, useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Modal, ModalProps } from '@grafana/ui';

import { stringifyErrorLike } from '../../../utils/misc';

/**
 * This hook controls the delete modal for routing trees, showing loading and error states when appropriate
 */
export const useDeleteRoutingTreeModal = (
  handleDelete: ({ name, resourceVersion }: { name: string; resourceVersion?: string }) => Promise<unknown>
) => {
  const [showModal, setShowModal] = useState(false);
  const [routingTree, setRoutingTree] = useState<{ name: string; resourceVersion?: string }>();
  const [error, setError] = useState<unknown | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = useCallback(() => {
    if (isLoading) {
      return;
    }
    setRoutingTree(undefined);
    setShowModal(false);
    setError(undefined);
  }, [isLoading]);

  const handleShow = useCallback(({ name, resourceVersion }: { name: string; resourceVersion?: string }) => {
    setRoutingTree({ name, resourceVersion });
    setShowModal(true);
    setError(undefined);
  }, []);

  const handleSubmit = useCallback(() => {
    if (routingTree) {
      setIsLoading(true);
      handleDelete(routingTree)
        .then(() => setShowModal(false))
        .catch(setError)
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [handleDelete, routingTree]);

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
        title={'Delete routing tree'}
      >
        <p>
          Deleting this routing tree will permanently remove it.
        </p>
        <p>
          Are you sure you want to delete this routing tree?
        </p>

        <Modal.ButtonRow>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={isLoading}>
            {isLoading
              ? "Deleting..."
              : "Yes, delete routing tree"}
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
const ErrorModal = ({ isOpen, onDismiss, error }: ErrorModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      closeOnBackdropClick={true}
      closeOnEscape={true}
      title={t('alerting.error-modal.title-something-went-wrong', 'Something went wrong')}
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
};
