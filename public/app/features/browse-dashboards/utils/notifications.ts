import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';

interface RestoreFailure {
  uid: string;
  error: string;
}

interface NotificationData {
  alertType: string;
  message: string;
}

export function getRestoreNotificationData(successful: string[], failed: RestoreFailure[]): NotificationData | null {
  const successCount = successful.length;
  const failedCount = failed.length;

  if (successCount === 0 && failedCount === 0) {
    return null;
  }

  // Generate count-aware success message (reused in multiple cases)
  const successMessage = t('browse-dashboards.restore.success-count', '{{count}} dashboard restored successfully', {
    count: successCount,
  });

  // All success case
  if (failedCount === 0) {
    return {
      alertType: AppEvents.alertSuccess.name,
      message: successMessage,
    };
  }

  // Helper to append first error message if present
  const firstError = failed[0]?.error;
  const appendError = (msg: string) => (firstError ? `${msg}. ${firstError}` : msg);

  // Partial success case
  if (successCount > 0) {
    const failedMessage = t('browse-dashboards.restore.failed-count', '{{count}} dashboard failed', {
      count: failedCount,
    });
    return {
      alertType: AppEvents.alertWarning.name,
      message: appendError(`${successMessage}. ${failedMessage}.`),
    };
  }

  // All failed case
  return {
    alertType: AppEvents.alertError.name,
    message: appendError(
      t('browse-dashboards.restore.all-failed', 'Failed to restore {{count}} dashboard.', {
        count: failedCount,
      })
    ),
  };
}
