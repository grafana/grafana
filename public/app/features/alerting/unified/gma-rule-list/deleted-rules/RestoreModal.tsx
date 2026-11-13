import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Alert, ConfirmModal } from '@grafana/ui';

import { useRestoreAlertRule } from './useRestoreRule';

interface RestoreModalProps {
  rule: AlertRule;
  onDismiss: () => void;
  onSuccess: (restoredName: string) => void;
}

export function RestoreModal({ rule, onDismiss, onSuccess }: RestoreModalProps) {
  const { restore, isRestoring } = useRestoreAlertRule();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const title = rule.spec?.title ?? '';

  const handleConfirm = async () => {
    setError(null);
    const result = await restore(rule);
    if (result.success) {
      setRestored(true);
      onSuccess(rule.metadata?.name ?? '');
    } else if (result.isConflict) {
      setError(t('alerting.recently-deleted.restore.conflict', 'A rule with this name already exists.'));
    } else {
      setError(t('alerting.recently-deleted.restore.error', 'Failed to restore rule. Please try again.'));
    }
  };

  if (restored) {
    return (
      <ConfirmModal
        isOpen
        title={t('alerting.recently-deleted.restore.success-title', 'Rule restored')}
        body={t('alerting.recently-deleted.restore.success-body', '"{{title}}" has been restored.', {
          title,
          interpolation: { escapeValue: false },
        })}
        confirmText={t('alerting.recently-deleted.restore.close', 'Close')}
        onConfirm={onDismiss}
        onDismiss={onDismiss}
      />
    );
  }

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
