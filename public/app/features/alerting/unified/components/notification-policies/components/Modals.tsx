import React, { FC, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, Modal, ModalProps, Space, Spinner, Stack, Text } from '@grafana/ui';

import { RouteWithID } from '../../../../../../plugins/datasource/alertmanager/types';
import { FormAmRoute } from '../../../types/amroutes';
import { defaultGroupBy } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { ROOT_ROUTE_NAME } from '../../../utils/k8s/constants';
import { stringifyErrorLike } from '../../../utils/misc';
import { AmRootRouteForm } from '../EditDefaultPolicyForm';

export interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<unknown>;
  onDismiss: () => void;
  routeName: string;
}

export const DeleteModal = React.memo(({ onConfirm, onDismiss, isOpen, routeName }: DeleteModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<unknown | undefined>();

  const onDeleteDismiss = () => {
    onDismiss();
    setError(undefined);
  };

  const onDeleteConfirm = async () => {
    setIsDeleting(true);
    onConfirm()
      .then(() => {
        onDeleteDismiss();
      })
      .catch(setError)
      .finally(() => {
        setIsDeleting(false);
      });
  };
  if (error) {
    return <ErrorModal isOpen={isOpen} onDismiss={onDeleteDismiss} error={error} />;
  }

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans
              i18nKey="alerting.policies.delete-modal.permanently-remove"
              values={{ routeName: routeName === ROOT_ROUTE_NAME || !routeName ? 'Default Policy' : routeName }}
            >
              This action will permanently remove the <code>{'{{routeName}}'}</code> notification policy.
            </Trans>
          </Text>
          <Space v={2} />
        </>
      }
      confirmationText={t('alerting.common.delete', 'Delete')}
      confirmText={isDeleting ? t('alerting.common.deleting', 'Deleting...') : t('alerting.common.delete', 'Delete')}
      onDismiss={onDeleteDismiss}
      onConfirm={onDeleteConfirm}
      title={t('alerting.policies.delete-modal.title-delete-notification-policy', 'Delete notification policy')}
      isOpen={isOpen}
    />
  );
});
DeleteModal.displayName = 'DeleteModal';

export interface ResetModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<unknown>;
  onDismiss: () => void;
  routeName: string;
}

export const ResetModal = React.memo(({ onConfirm, onDismiss, isOpen, routeName }: ResetModalProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<unknown | undefined>();

  const onResetDismiss = () => {
    onDismiss();
    setError(undefined);
  };

  const onResetConfirm = async () => {
    setIsResetting(true);
    onConfirm()
      .then(() => {
        onResetDismiss();
      })
      .catch(setError)
      .finally(() => {
        setIsResetting(false);
      });
  };
  if (error) {
    return <ErrorModal isOpen={isOpen} onDismiss={onResetDismiss} error={error} />;
  }

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans
              i18nKey="alerting.policies.reset-modal.permanently-reset"
              values={{ routeName: routeName === ROOT_ROUTE_NAME || !routeName ? 'Default Policy' : routeName }}
            >
              This action will permanently reset the <code>{'{{routeName}}'}</code> notification policy to an empty
              state.
            </Trans>
          </Text>
          <Space v={2} />
        </>
      }
      confirmationText={t('alerting.policies.reset-modal.reset', 'Reset')}
      confirmText={
        isResetting
          ? t('alerting.policies.reset-modal.resetting', 'Resetting...')
          : t('alerting.policies.reset-modal.reset', 'Reset')
      }
      onDismiss={onResetDismiss}
      onConfirm={onResetConfirm}
      title={t('alerting.policies.reset-modal.title-reset-notification-policy', 'Reset notification policy')}
      isOpen={isOpen}
    />
  );
});
ResetModal.displayName = 'ResetModal';

const emptyRouteWithID = {
  id: '',
  name: '',
  group_by: defaultGroupBy,
};

export interface CreateModalProps {
  isOpen: boolean;
  onConfirm: (route: Partial<FormAmRoute>) => Promise<unknown>;
  onDismiss: () => void;
}

export const CreateModal = React.memo(({ onConfirm, onDismiss, isOpen }: CreateModalProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<unknown | undefined>();
  const [route, setRoute] = useState<RouteWithID>(emptyRouteWithID);

  const onCreateDismiss = () => {
    onDismiss();
    setError(undefined);
    setRoute(emptyRouteWithID);
  };

  const onCreateConfirm = async (newRoute: Partial<FormAmRoute>) => {
    if (newRoute) {
      setIsCreating(true);
      onConfirm(newRoute)
        .then(() => {
          onCreateDismiss();
        })
        .catch(setError)
        .finally(() => {
          setIsCreating(false);
        });
    }
  };
  if (error) {
    return <ErrorModal isOpen={isOpen} onDismiss={onCreateDismiss} error={error} />;
  }

  if (isCreating) {
    return <CreatingModal isOpen={isOpen} onDismiss={onCreateDismiss} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onCreateDismiss}
      closeOnBackdropClick={true}
      closeOnEscape={true}
      title={t('alerting.policies.create-modal.title-new-notification-policy', 'New notification policy')}
    >
      <AmRootRouteForm
        route={route}
        showNameField={true}
        onSubmit={onCreateConfirm}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        actionButtons={
          <Modal.ButtonRow>
            <Button type="button" variant="secondary" onClick={onCreateDismiss}>
              <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans i18nKey="alerting.common.create">Create</Trans>
            </Button>
          </Modal.ButtonRow>
        }
      />
    </Modal>
  );
});
CreateModal.displayName = 'CreateModal';

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
      title={t('alerting.policies.error-modal.title-something-went-wrong', 'Something went wrong')}
    >
      <p>
        <Trans i18nKey="alerting.policies.error-modal.failed-to-update-your-configuration">
          Failed to update your configuration:
        </Trans>
      </p>
      <pre>
        <code>{stringifyErrorLike(error)}</code>
      </pre>
    </Modal>
  );
};

const CreatingModal: FC<Pick<ModalProps, 'isOpen' | 'onDismiss'>> = ({ isOpen, onDismiss = () => {} }) => (
  <Modal
    isOpen={isOpen}
    onDismiss={onDismiss}
    closeOnBackdropClick={false}
    closeOnEscape={false}
    ariaLabel={t('alerting.policies.create-modal.creating', 'Creating...')}
    title={
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Trans i18nKey="alerting.policies.create-modal.creating">Creating...</Trans> <Spinner inline />
      </Stack>
    }
  >
    <Trans i18nKey="alerting.policies.create-modal.please-wait">
      Please wait while we create your notification policy.
    </Trans>
  </Modal>
);
