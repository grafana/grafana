import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import {
  type Repository,
  useDeleteRepositoryMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { isRepositoryInaccessible } from '../utils/repositoryStatus';

// CLEANUP_FINALIZER removes the provider-side webhook on delete; it's the only
// finalizer that needs the repository to be reachable. Dropping it lets an
// unhealthy repository (e.g. expired credentials) finish deleting.
const CLEANUP_FINALIZER = 'cleanup';

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

  // When the repository is unreachable (e.g. its credentials have expired) the
  // backend can't remove provider-side resources such as webhooks, which would
  // otherwise block deletion forever. In that case we force the deletion by
  // dropping the cleanup finalizer and warn the user those remote resources
  // will be left behind.
  const inaccessible = isRepositoryInaccessible(repository);

  const performDelete = useCallback(
    async (deleteAction: DeleteAction) => {
      const keepResources = deleteAction === 'keep-resources';

      // Work out the finalizer set we want before deleting. keep-resources
      // swaps remove-orphan for release-orphan; remove-resources leaves the
      // repository's finalizers as they are. An unhealthy repository then drops
      // the cleanup finalizer so the provider-side webhook step is skipped.
      let finalizers: string[] | undefined;
      if (keepResources) {
        finalizers = [CLEANUP_FINALIZER, 'release-orphan-resources'];
      }
      if (inaccessible) {
        const base = finalizers ?? repository?.metadata?.finalizers ?? [];
        finalizers = base.filter((finalizer) => finalizer !== CLEANUP_FINALIZER);
      }

      if (finalizers && repository) {
        await replaceRepository({
          name,
          repository: { ...repository, metadata: { ...repository.metadata, finalizers } },
        });
      }

      reportInteraction('grafana_provisioning_repository_deleted', {
        repositoryName: name,
        repositoryType: repository?.spec?.type ?? 'unknown',
        deleteAction,
        forceDelete: inaccessible,
        target: repository?.spec?.sync?.target ?? 'unknown',
        workflows: repository?.spec?.workflows ?? [],
      });

      await deleteRepository({ name });

      if (redirectTo) {
        navigate(redirectTo);
      }
    },
    [deleteRepository, replaceRepository, name, repository, redirectTo, navigate, inaccessible]
  );

  // Appended to the confirm text when the repository is unreachable, so the user
  // knows the delete will proceed but leave provider-side resources behind.
  const unhealthyWarning = t(
    'provisioning.delete-repository-button.unhealthy-warning',
    ' This repository is currently unhealthy (for example, its credentials may have expired), so provider-side resources such as webhooks cannot be removed and will be left in place. To remove them, fix the credentials before deleting.'
  );

  const showDeleteWithResourcesModal = useCallback(() => {
    const baseText = t(
      'provisioning.delete-repository-button.confirm-delete-with-resources',
      'Are you sure you want to delete the repository configuration and all its resources?'
    );
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t(
          'provisioning.delete-repository-button.title-delete-repository-and-resources',
          'Delete repository configuration and resources'
        ),
        text: inaccessible ? baseText + unhealthyWarning : baseText,
        yesText: t('provisioning.delete-repository-button.button-delete', 'Delete'),
        noText: t('provisioning.delete-repository-button.button-cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: () => performDelete('remove-resources'),
      })
    );
  }, [performDelete, inaccessible, unhealthyWarning]);

  const showDeleteKeepResourcesModal = useCallback(() => {
    const baseText = t(
      'provisioning.delete-repository-button.confirm-delete-keep-resources',
      'Are you sure you want to delete the repository configuration but keep its resources?'
    );
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t(
          'provisioning.delete-repository-button.title-delete-repository-only',
          'Delete repository configuration only'
        ),
        text: inaccessible ? baseText + unhealthyWarning : baseText,
        yesText: t('provisioning.delete-repository-button.button-delete', 'Delete'),
        noText: t('provisioning.delete-repository-button.button-cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: () => performDelete('keep-resources'),
      })
    );
  }, [performDelete, inaccessible, unhealthyWarning]);

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
