import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { Alert, Stack } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

const preserveNewlines = css({ whiteSpace: 'pre-line' });

export function RepositoryStatusAlert({ repository }: { repository: Repository }) {
  const deleteError = repository.status?.deleteError;
  const errors = [
    ...(deleteError ? [deleteError] : []),
    ...(repository.status?.fieldErrors?.flatMap((error) => (error.detail ? [error.detail] : [])) ?? []),
  ];

  if (errors.length) {
    return (
      <Alert
        severity="error"
        title={
          deleteError
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
        </Stack>
      </Alert>
    );
  }

  return null;
}
