import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { BulkMoveResult } from './utils';

// TODO: Adjust this for bulk delete operation
export function BulkMoveFailedBanner({ result, onDismiss }: { result: BulkMoveResult; onDismiss: () => void }) {
  function getMessage(item: BulkMoveResult['failed'][0]) {
    switch (item.failureType) {
      case 'create':
        return (
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-create">
            Failed to create resource in target location
          </Trans>
        );
      case 'delete':
        return (
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-delete">
            Resource was created at new location but could not be deleted from original location. Please manually remove
            the old file.
          </Trans>
        );
      case 'data-fetch':
      default:
        return (
          <Trans i18nKey="browse-dashboards.bulk-move-resources-form.failed-fetch">Failed to fetch resource data</Trans>
        );
    }
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
            <strong>{item.title || item.uid}</strong> - {getMessage(item)}
            {item.error && `: ${item.error}`}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
