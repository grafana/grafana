import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

interface RestoreFailure {
  uid: string;
  error: string;
}

interface NotificationEventData {
  alertType: string;
  message: string;
}

interface NotificationActionData {
  title: string;
  buttonLabel: string;
  targetUrl: string;
}

export type RestoreNotificationData =
  | { kind: 'action'; data: NotificationActionData }
  | { kind: 'event'; data: NotificationEventData };

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
            ? t('browse-dashboards.restore.success', 'Dashboard restored')
            : t('browse-dashboards.restore.success-multi', 'Dashboards restored'),
        buttonLabel:
          successCount === 1
            ? t('browse-dashboards.restore.view-dashboard', 'View dashboard')
            : t('browse-dashboards.restore.view-folder', 'View folder'),
        targetUrl:
          successCount === 1
            ? `/d/${successful[0]}`
            : !restoreTarget || restoreTarget === GENERAL_FOLDER_UID
              ? '/dashboards'
              : `/dashboards/f/${restoreTarget}`,
      },
    };
  }

  // Generate count-aware success message (reused in multiple cases)
  const successMessage = t('browse-dashboards.restore.success-count', '{{count}} dashboard restored successfully', {
    count: successCount,
  });

  // Helper to append first error message if present
  const firstError = failed[0]?.error;
  const appendError = (msg: string) => (firstError ? `${msg}. ${firstError}` : msg);

  // Partial success case
  if (successCount > 0) {
    const failedMessage = t('browse-dashboards.restore.failed-count', '{{count}} dashboard failed', {
      count: failedCount,
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
        t('browse-dashboards.restore.all-failed', 'Failed to restore {{count}} dashboard.', {
          count: failedCount,
        })
      ),
    },
  };
}
