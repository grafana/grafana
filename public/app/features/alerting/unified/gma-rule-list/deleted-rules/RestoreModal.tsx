import { useState } from 'react';

import { t } from '@grafana/i18n';
import { isFetchError, locationService } from '@grafana/runtime';
import { Alert, ConfirmModal } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { type RuleKind } from '../shared/ruleKind';

import { trackRestoreAttempt, trackRestoreFailure, trackRestoreSuccess } from './analytics';
import { type DeletedRule, type RuleRestorer } from './deletedRulesPage';

interface RestoreModalProps {
  kind: RuleKind;
  rule: DeletedRule;
  restorer: RuleRestorer;
  title: string;
  onDismiss: () => void;
  onRefetch?: () => void;
}

export function RestoreModal({ kind, rule, restorer, title, onDismiss, onRefetch }: RestoreModalProps) {
  const [error, setError] = useState<string | null>(null);
  const ruleTitle = rule.spec?.title ?? '';
  const uid = rule.metadata?.name ?? '';

  const handleConfirm = async () => {
    setError(null);
    trackRestoreAttempt(kind);
    try {
      const result = await restorer.restore(rule);
      if (result.success) {
        trackRestoreSuccess(kind);
        locationService.push(grafanaRulesNav.viewLink(uid, { includeReturnTo: true }));
      } else if (result.isConflict) {
        trackRestoreFailure(kind, 'conflict');
        onRefetch?.();
        setError(t('alerting.recently-deleted.restore.conflict', 'A rule with this name already exists.'));
      } else {
        trackRestoreFailure(kind, 'error');
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
      trackRestoreFailure(kind, 'error');
      setError(t('alerting.recently-deleted.restore.error', 'Failed to restore rule. Please try again.'));
    }
  };

  return (
    <ConfirmModal
      isOpen
      title={title}
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
        restorer.isRestoring
          ? t('alerting.recently-deleted.restore.restoring', 'Restoring…')
          : t('alerting.recently-deleted.restore.confirm', 'Restore')
      }
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
      disabled={restorer.isRestoring}
    />
  );
}
