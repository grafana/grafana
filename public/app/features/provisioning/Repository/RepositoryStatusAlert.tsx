import { css } from '@emotion/css';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Stack } from '@grafana/ui';
import { type Repository, useReplaceRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { PROVISIONING_URL } from '../constants';

const preserveNewlines = css({ whiteSpace: 'pre-line' });

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
        {blockingFinalizer && (
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
