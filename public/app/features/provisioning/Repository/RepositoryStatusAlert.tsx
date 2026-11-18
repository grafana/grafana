import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Spinner, Stack } from '@grafana/ui';
import { type Repository, useReplaceRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { PROVISIONING_URL } from '../constants';
import { useOrphanedResourceActions } from '../hooks/useOrphanedResourceActions';

const preserveNewlines = css({ whiteSpace: 'pre-line' });

const REMOVE_RESOURCES_FINALIZER = 'remove-orphan-resources';

export function RepositoryStatusAlert({ repository }: { repository: Repository }) {
  const [replaceRepository, replaceRequest] = useReplaceRepositoryMutation();
  const navigate = useNavigate();

  const deletion = repository.status?.deletion;
  // status.deletion is the structured signal; deleteError is the deprecated
  // free-text kept for older backends. Prefer the structured message.
  const deletionMessage = deletion?.message ?? repository.status?.deleteError;
  // The backend names exactly which finalizer is blocking deletion; force-remove
  // that one rather than guessing (e.g. cleanup for a webhook that can't be removed).
  const blockingFinalizer = deletion?.finalizer;
  // Finalizers cannot be added to a terminating object, so the remove/release
  // finalizer cannot be swapped anymore. Instead, a releaseResources job (allowed
  // for terminating repositories) releases what is left; the finalizer then
  // finds nothing to remove and the deletion completes.
  const canRelease = blockingFinalizer === REMOVE_RESOURCES_FINALIZER;
  const { submitRelease, isSubmitting: isReleasing } = useOrphanedResourceActions({
    repositoryName: repository.metadata?.name ?? '',
  });
  const [releaseRequested, setReleaseRequested] = useState(false);

  const errors = [
    ...(deletionMessage ? [deletionMessage] : []),
    ...(repository.status?.fieldErrors?.flatMap((error) => (error.detail ? [error.detail] : [])) ?? []),
  ];

  const forceDelete = useCallback(() => {
    const name = repository.metadata?.name;
    if (!name || !blockingFinalizer) {
      return;
    }

    const finalizers = (repository.metadata?.finalizers ?? []).filter((finalizer) => finalizer !== blockingFinalizer);

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('provisioning.repository-status-alert.force-delete-title', 'Delete repository anyway'),
        text: t(
          'provisioning.repository-status-alert.force-delete-warning',
          'This removes the repository without completing the blocking step, so anything it manages on the provider side (for example a webhook) is left in place. Only do this if the repository can no longer be reached — for example its credentials have expired or been revoked.'
        ),
        yesText: t('provisioning.repository-status-alert.force-delete-confirm', 'Delete anyway'),
        noText: t('provisioning.repository-status-alert.force-delete-cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: async () => {
          reportInteraction('grafana_provisioning_repository_deleted', {
            repositoryName: name,
            repositoryType: repository.spec?.type ?? 'unknown',
            forceDelete: true,
            finalizer: blockingFinalizer,
            target: repository.spec?.sync?.target ?? 'unknown',
            workflows: repository.spec?.workflows ?? [],
          });

          try {
            await replaceRepository({
              name,
              repository: { ...repository, metadata: { ...repository.metadata, finalizers } },
            }).unwrap();
          } catch {
            return;
          }

          navigate(PROVISIONING_URL);
        },
      })
    );
  }, [replaceRepository, repository, blockingFinalizer, navigate]);

  const releaseAll = useCallback(() => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('provisioning.repository-status-alert.release-title', 'Release all resources'),
        text: t(
          'provisioning.repository-status-alert.release-warning',
          'Instead of deleting them, the remaining folders and resources managed by this repository are kept in Grafana and become editable again. Unmanaged resources are not affected. The repository is removed once they are released.'
        ),
        yesText: t('provisioning.repository-status-alert.release-confirm', 'Release all resources'),
        noText: t('provisioning.repository-status-alert.force-delete-cancel', 'Cancel'),
        yesButtonVariant: 'primary',
        onConfirm: async () => {
          if (await submitRelease()) {
            setReleaseRequested(true);
          }
        },
      })
    );
  }, [submitRelease]);

  if (!errors.length) {
    return null;
  }

  return (
    <Alert
      severity="error"
      title={
        deletionMessage
          ? t('provisioning.repository-status-alert.deletion-title', 'Repository deletion error')
          : t('provisioning.repository-status-alert.error-title', 'Repository error')
      }
    >
      <Stack direction="column" gap={1}>
        {errors.map((error, index) => (
          <div className={preserveNewlines} key={index}>
            {error}
          </div>
        ))}
        {canRelease && releaseRequested && (
          <Stack alignItems="center" gap={1}>
            <Spinner />
            <Trans i18nKey="provisioning.repository-status-alert.release-in-progress">
              Releasing resources. The repository is removed on the next cleanup attempt, which can take a minute.
            </Trans>
          </Stack>
        )}
        {canRelease && !releaseRequested && (
          <div>
            <Button variant="primary" size="sm" onClick={releaseAll} disabled={isReleasing}>
              <Trans i18nKey="provisioning.repository-status-alert.release-button">Release all resources</Trans>
            </Button>
          </div>
        )}
        {blockingFinalizer && !canRelease && (
          <div>
            <Button variant="destructive" size="sm" onClick={forceDelete} disabled={replaceRequest.isLoading}>
              <Trans i18nKey="provisioning.repository-status-alert.force-delete-button">Delete anyway</Trans>
            </Button>
          </div>
        )}
      </Stack>
    </Alert>
  );
}
