import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import {
  Repository,
  useDeleteRepositoryMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

type DeleteAction = 'remove-resources' | 'keep-resources';

interface Props {
  name: string;
  repository: Repository;
  redirectTo?: string;
}

export function DeleteRepositoryButton({ name, repository, redirectTo }: Props) {
  const [deleteRepository, deleteRequest] = useDeleteRepositoryMutation();
  const [replaceRepository, replaceRequest] = useReplaceRepositoryMutation();
  const navigate = useNavigate();

  const performDelete = useCallback(
    async (deleteAction: DeleteAction) => {
      if (deleteAction === 'keep-resources' && repository) {
        const updatedRepository = {
          ...repository,
          metadata: {
            ...repository.metadata,
            finalizers: ['cleanup', 'release-orphan-resources'],
          },
        };
        await replaceRepository({ name, repository: updatedRepository });
      }

      reportInteraction('grafana_provisioning_repository_deleted', {
        repositoryName: name,
        repositoryType: repository?.spec?.type ?? 'unknown',
        deleteAction,
        target: repository?.spec?.sync?.target ?? 'unknown',
        workflows: repository?.spec?.workflows ?? [],
      });

      await deleteRepository({ name });

      if (redirectTo) {
        navigate(redirectTo);
      }
    },
    [deleteRepository, replaceRepository, name, repository, redirectTo, navigate]
  );

  const showDeleteWithResourcesModal = useCallback(() => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t(
          'provisioning.delete-repository-button.title-delete-repository-and-resources',
          'Delete repository configuration and resources'
        ),
        text: t(
          'provisioning.delete-repository-button.confirm-delete-with-resources',
          'Are you sure you want to delete the repository configuration and all its resources?'
        ),
        yesText: t('provisioning.delete-repository-button.button-delete', 'Delete'),
        noText: t('provisioning.delete-repository-button.button-cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: () => performDelete('remove-resources'),
      })
    );
  }, [performDelete]);

  const showDeleteKeepResourcesModal = useCallback(() => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t(
          'provisioning.delete-repository-button.title-delete-repository-only',
          'Delete repository configuration only'
        ),
        text: t(
          'provisioning.delete-repository-button.confirm-delete-keep-resources',
          'Are you sure you want to delete the repository configuration but keep its resources?'
        ),
        yesText: t('provisioning.delete-repository-button.button-delete', 'Delete'),
        noText: t('provisioning.delete-repository-button.button-cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: () => performDelete('keep-resources'),
      })
    );
  }, [performDelete]);

  const isLoading = deleteRequest.isLoading || replaceRequest.isLoading;

  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            label={t(
              'provisioning.delete-repository-button.delete-and-remove-resources',
              'Delete and remove resources (default)'
            )}
            onClick={showDeleteWithResourcesModal}
          />
          <Menu.Item
            label={t('provisioning.delete-repository-button.delete-and-keep-resources', 'Delete and keep resources')}
            onClick={showDeleteKeepResourcesModal}
          />
        </Menu>
      }
    >
      <Button variant="destructive" disabled={isLoading}>
        <Stack alignItems="center">
          <Trans i18nKey="provisioning.delete-repository-button.delete">Delete</Trans>
          <Icon name={'angle-down'} />
        </Stack>
      </Button>
    </Dropdown>
  );
}
