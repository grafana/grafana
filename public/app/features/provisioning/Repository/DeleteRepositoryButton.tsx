import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Button, ConfirmModal, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import {
  Repository,
  useDeleteRepositoryMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';

type DeleteAction = 'remove-resources' | 'keep-resources';

interface Props {
  name: string;
  repository: Repository;
  redirectTo?: string;
}

export function DeleteRepositoryButton({ name, repository, redirectTo }: Props) {
  const [deleteRepository, deleteRequest] = useDeleteRepositoryMutation();
  const [replaceRepository, replaceRequest] = useReplaceRepositoryMutation();
  const [showModal, setShowModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DeleteAction>('remove-resources');
  const navigate = useNavigate();

  useEffect(() => {
    if (deleteRequest.isSuccess) {
      setShowModal(false);
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  }, [deleteRequest.isSuccess, redirectTo, navigate]);

  const onConfirm = useCallback(async () => {
    if (selectedAction === 'keep-resources' && repository) {
      const updatedRepository = {
        ...repository,
        metadata: {
          ...repository.metadata,
          finalizers: ['cleanup', 'release-orphan-resources'],
        },
      };
      await replaceRepository({ name, repository: updatedRepository });
    }
    deleteRepository({ name });
  }, [deleteRepository, replaceRepository, name, selectedAction, repository]);

  const getConfirmationMessage = () => {
    if (selectedAction === 'remove-resources') {
      return t(
        'provisioning.delete-repository-button.confirm-delete-with-resources',
        'Are you sure you want to delete the repository configuration and all its resources?'
      );
    }
    return t(
      'provisioning.delete-repository-button.confirm-delete-keep-resources',
      'Are you sure you want to delete the repository configuration but keep its resources?'
    );
  };

  const getModalTitle = () => {
    if (selectedAction === 'remove-resources') {
      return t(
        'provisioning.delete-repository-button.title-delete-repository-and-resources',
        'Delete repository configuration and resources'
      );
    }
    return t(
      'provisioning.delete-repository-button.title-delete-repository-only',
      'Delete repository configuration only'
    );
  };

  const isLoading = deleteRequest.isLoading || replaceRequest.isLoading;

  return (
    <>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t(
                'provisioning.delete-repository-button.delete-and-remove-resources',
                'Delete and remove resources (default)'
              )}
              onClick={() => {
                setSelectedAction('remove-resources');
                setShowModal(true);
              }}
            />
            <Menu.Item
              label={t('provisioning.delete-repository-button.delete-and-keep-resources', 'Delete and keep resources')}
              onClick={() => {
                setSelectedAction('keep-resources');
                setShowModal(true);
              }}
            />
          </Menu>
        }
      >
        <Button variant="destructive" icon="trash-alt" disabled={isLoading}>
          <Stack alignItems="center">
            <Trans i18nKey="provisioning.delete-repository-button.delete">Delete</Trans>
            <Icon name={'angle-down'} />
          </Stack>
        </Button>
      </Dropdown>
      <ConfirmModal
        isOpen={showModal}
        title={getModalTitle()}
        body={getConfirmationMessage()}
        confirmText={t('provisioning.delete-repository-button.button-delete', 'Delete')}
        onConfirm={onConfirm}
        onDismiss={() => setShowModal(false)}
      />
    </>
  );
}
