import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { BulkMoveResult } from './utils';

// TODO: Adjust this for bulk delete operation
export function BulkMoveFailedBanner({ result, onDismiss }: { result: BulkMoveResult; onDismiss: () => void }) {
  if (result.failed.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="error"
      title={t('browse-dashboards.bulk-move-resources-form.failed-alert', 'Move Failed')}
      onRemove={onDismiss}
    >
      <ul>
        {result.failed.map((item) => (
          <li key={item.uid}>
            <strong>{item.title || item.uid}</strong> -{' '}
            {item.failureType === 'create' ? (
              <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-create">
                Failed to create resource in target location
              </Trans>
            ) : item.failureType === 'delete' ? (
              <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-delete">
                Resource was created at new location but could not be deleted from original location. Please manually
                remove the old file.
              </Trans>
            ) : (
              <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-fetch">
                Failed to fetch resource data
              </Trans>
            )}
            {item.error && `: ${item.error}`}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
