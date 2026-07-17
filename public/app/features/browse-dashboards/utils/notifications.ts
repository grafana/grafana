import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { isRootFolderUID } from 'app/features/search/constants';

import { type RestoreNotificationData } from '../types';

interface RestoreFailure {
  uid: string;
  error: string;
}

export function getRestoreNotificationData(
  successful: string[],
  failed: RestoreFailure[],
  restoreTarget?: string
): RestoreNotificationData | null {
  const successCount = successful.length;
  const failedCount = failed.length;

  if (successCount === 0 && failedCount === 0) {
    return null;
  }

  // All success case
  if (failedCount === 0) {
    return {
      kind: 'action',
      data: {
        title:
          successCount === 1
            ? t('browse-dashboards.restore.success-single', 'Dashboard restored')
            : t('browse-dashboards.restore.success-multiple', 'Dashboards restored'),
        buttonLabel:
          successCount === 1
            ? t('browse-dashboards.restore.view-dashboard', 'View dashboard')
            : t('browse-dashboards.restore.view-folder', 'View folder'),
        targetUrl:
          successCount === 1
            ? `${config.appSubUrl}/d/${successful[0]}`
            : isRootFolderUID(restoreTarget)
              ? `${config.appSubUrl}/dashboards`
              : `${config.appSubUrl}/dashboards/f/${restoreTarget}`,
      },
    };
  }

  // Generate count-aware success message (reused in multiple cases)
  const successMessage = t('browse-dashboards.restore.success-count', '', {
    count: successCount,
    defaultValue_one: '{{count}} dashboard restored successfully',
    defaultValue_other: '{{count}} dashboard restored successfully',
  });

  // Helper to append first error message if present
  const firstError = failed[0]?.error;
  const appendError = (msg: string) => {
    if (!firstError) {
      return msg;
    }
    const separator = msg.endsWith('.') ? ' ' : '. ';
    return `${msg}${separator}${firstError}`;
  };

  // Partial success case
  if (successCount > 0) {
    const failedMessage = t('browse-dashboards.restore.failed-count', '', {
      count: failedCount,
      defaultValue_one: '{{count}} dashboard failed',
      defaultValue_other: '{{count}} dashboard failed',
    });
    return {
      kind: 'event',
      data: {
        alertType: AppEvents.alertWarning.name,
        message: appendError(`${successMessage}. ${failedMessage}.`),
      },
    };
  }

  // All failed case
  return {
    kind: 'event',
    data: {
      alertType: AppEvents.alertError.name,
      message: appendError(
        t('browse-dashboards.restore.all-failed', '', {
          count: failedCount,
          defaultValue_one: 'Failed to restore {{count}} dashboard.',
          defaultValue_other: 'Failed to restore {{count}} dashboard.',
        })
      ),
    },
  };
}
