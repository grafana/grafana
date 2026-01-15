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

  let alertType = AppEvents.alertSuccess.name;
  let message = t('browse-dashboards.restore.success', 'Dashboards restored successfully');

  if (failedCount > 0) {
    const firstError = failed[0]?.error;

    if (successCount > 0) {
      // Partial success
      alertType = AppEvents.alertWarning.name;
      const successMessage = t('browse-dashboards.restore.success-count', '{{count}} dashboard restored successfully', {
        count: successCount,
      });
      const failedMessage = t('browse-dashboards.restore.failed-count', '{{count}} dashboard failed', {
        count: failedCount,
      });
      message = `${successMessage}. ${failedMessage}.`;
      if (firstError) {
        message += `. ${firstError}`;
      }
    } else {
      // All failed
      alertType = AppEvents.alertError.name;
      message = t('browse-dashboards.restore.all-failed', 'Failed to restore {{count}} dashboard.', {
        count: failedCount,
      });
      if (firstError) {
        message += `. ${firstError}`;
      }
    }
  }

  return { alertType, message };
}
