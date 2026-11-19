import { useState } from 'react';

import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, ConfirmModal } from '@grafana/ui';

import { type DeletedRule, type RestoreResult } from './types';

interface RestoreModalProps {
  rule: DeletedRule;
  restore: (rule: DeletedRule) => Promise<RestoreResult>;
  isRestoring: boolean;
  navigateAfterRestore: (uid: string) => void;
  /** Modal title. Defaults to 'Restore alert rule'. */
  title?: string;
  onAttempt?: () => void;
  onSuccess?: () => void;
  onFailure?: (reason: 'conflict' | 'error') => void;
  onDismiss: () => void;
  onRefetch?: () => void;
}

export function RestoreModal({
  rule,
  restore,
  isRestoring,
  navigateAfterRestore,
  title,
  onAttempt,
  onSuccess,
  onFailure,
  onDismiss,
  onRefetch,
}: RestoreModalProps) {
  const [error, setError] = useState<string | null>(null);
  const ruleTitle = rule.spec?.title ?? '';
  const uid = rule.metadata?.name ?? '';

  const handleConfirm = async () => {
    setError(null);
    onAttempt?.();
    try {
      const result = await restore(rule);
      if (result.success) {
        onSuccess?.();
        navigateAfterRestore(uid);
      } else if (result.isConflict) {
        onFailure?.('conflict');
        onRefetch?.();
        setError(t('alerting.recently-deleted.restore.conflict', 'A rule with this name already exists.'));
      } else {
        onFailure?.('error');
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
      onFailure?.('error');
      setError(t('alerting.recently-deleted.restore.error', 'Failed to restore rule. Please try again.'));
    }
  };

  return (
    <ConfirmModal
      isOpen
      title={title ?? t('alerting.recently-deleted.restore.title', 'Restore alert rule')}
      body={
        <>
          {t('alerting.recently-deleted.restore.body', 'Restore "{{title}}"?', {
            title: ruleTitle,
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
