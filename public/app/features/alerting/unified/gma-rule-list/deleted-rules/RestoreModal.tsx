import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { isFetchError, locationService } from '@grafana/runtime';
import { Alert, ConfirmModal } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';

import { trackRestoreAttempt, trackRestoreFailure, trackRestoreSuccess } from './analytics';
import { useRestoreAlertRule } from './useRestoreRule';

interface RestoreModalProps {
  rule: AlertRule;
  onDismiss: () => void;
  onSuccess: (restoredName: string) => void;
  onRefetch?: () => void;
}

export function RestoreModal({ rule, onDismiss, onSuccess, onRefetch }: RestoreModalProps) {
  const { restore, isRestoring } = useRestoreAlertRule();
  const [error, setError] = useState<string | null>(null);
  const title = rule.spec?.title ?? '';
  const uid = rule.metadata?.name ?? '';

  const handleConfirm = async () => {
    setError(null);
    trackRestoreAttempt();
    try {
      const result = await restore(rule);
      if (result.success) {
        trackRestoreSuccess();
        onSuccess(uid);
        locationService.push(grafanaRulesNav.viewLink(uid, { includeReturnTo: true }));
      } else if (result.isConflict) {
        trackRestoreFailure('conflict');
        onRefetch?.();
        setError(t('alerting.recently-deleted.restore.conflict', 'A rule with this name already exists.'));
      } else {
        trackRestoreFailure('error');
        // Show the API's error message (e.g. folder missing/not writable) if available
        const errorData = isFetchError(result.error) ? result.error.data : null;
        const apiMessage =
          errorData !== null &&
          typeof errorData === 'object' &&
          'message' in errorData &&
          typeof errorData.message === 'string'
            ? errorData.message
            : '';
        setError(
          apiMessage || t('alerting.recently-deleted.restore.error', 'Failed to restore rule. Please try again.')
        );
      }
    } catch (err) {
      trackRestoreFailure('error');
      setError(t('alerting.recently-deleted.restore.error', 'Failed to restore rule. Please try again.'));
    }
  };

  return (
    <ConfirmModal
      isOpen
      title={t('alerting.recently-deleted.restore.title', 'Restore alert rule')}
      body={
        <>
          {t('alerting.recently-deleted.restore.body', 'Restore "{{title}}"?', {
            title,
            interpolation: { escapeValue: false },
          })}
          {error && <Alert title={error} severity="error" />}
        </>
      }
      confirmText={
        isRestoring
          ? t('alerting.recently-deleted.restore.restoring', 'Restoring…')
          : t('alerting.recently-deleted.restore.confirm', 'Restore')
      }
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
      disabled={isRestoring}
    />
  );
}
