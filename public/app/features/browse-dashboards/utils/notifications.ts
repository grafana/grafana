import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { isRootFolderUID } from 'app/features/search/constants';

import { type RestoreNotificationData } from '../types';

/** Fetch-step failure sentinel: the recently-deleted listing had no visible item for the uid. */
export const RESTORE_FETCH_NOT_FOUND = 'not_found';

interface RestoreFailure {
  uid: string;
  error: string;
  status?: number;
  step?: 'fetch' | 'create';
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

  // Failures the user can act on get guidance instead of the raw API error.
  // Create beats fetch: picking another folder is the action the user can take.
  const hasCreatePermissionFailure = failed.some((f) => f.step === 'create' && f.status === 403);
  const hasFetchFailure = failed.some(
    (f) => f.step === 'fetch' && (f.status === 403 || f.error === RESTORE_FETCH_NOT_FOUND)
  );

  const firstError = failed[0]?.error;
  const guidance = hasCreatePermissionFailure
    ? t(
        'browse-dashboards.restore.failed-create-permission',
        "You don't have permission to add dashboards to the selected folder. Choose a folder where you have edit permissions, or ask an administrator to restore the dashboards."
      )
    : hasFetchFailure
      ? t(
          'browse-dashboards.restore.failed-fetch',
          "The dashboards could no longer be found or you don't have permission to restore them. Ask an administrator to restore them."
        )
      : firstError;

  const appendGuidance = (msg: string) => {
    if (!guidance) {
      return msg;
    }
    const separator = msg.endsWith('.') ? ' ' : '. ';
    return `${msg}${separator}${guidance}`;
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
        message: appendGuidance(`${successMessage}. ${failedMessage}.`),
      },
    };
  }

  // All failed case
  return {
    kind: 'event',
    data: {
      alertType: AppEvents.alertError.name,
      message: appendGuidance(
        t('browse-dashboards.restore.all-failed', '', {
          count: failedCount,
          defaultValue_one: 'Failed to restore {{count}} dashboard.',
          defaultValue_other: 'Failed to restore {{count}} dashboard.',
        })
      ),
    },
  };
}
