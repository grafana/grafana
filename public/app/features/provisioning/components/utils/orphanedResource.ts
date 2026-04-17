import { t } from '@grafana/i18n';

export function getJobResultAlertByStatus(): Record<
  string,
  { severity: 'success' | 'warning' | 'error'; title: string }
> {
  return {
    success: {
      severity: 'success',
      title: t('provisioning.orphaned-resource-banner.job-success', 'Orphaned resources processed successfully'),
    },
    warning: {
      severity: 'warning',
      title: t(
        'provisioning.orphaned-resource-banner.job-warning',
        'Some resources were processed with warnings. Please review the results.'
      ),
    },
    error: {
      severity: 'error',
      title: t(
        'provisioning.orphaned-resource-banner.job-error',
        'An error occurred while processing orphaned resources'
      ),
    },
  };
}
