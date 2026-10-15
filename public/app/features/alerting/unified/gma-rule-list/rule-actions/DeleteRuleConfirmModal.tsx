import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Alert, ConfirmModal } from '@grafana/ui';

import { type DeleteRuleResult } from './useDeleteRule';

interface DeleteRuleConfirmModalProps {
  isOpen: boolean;
  ruleTitle: string;
  isDeleting: boolean;
  onConfirm: () => Promise<DeleteRuleResult>;
  onDismiss: () => void;
}

/** Keeps the last failure in the modal so the sequence-restriction explanation sits by the confirm button. */
export function DeleteRuleConfirmModal({
  isOpen,
  ruleTitle,
  isDeleting,
  onConfirm,
  onDismiss,
}: DeleteRuleConfirmModalProps) {
  const [error, setError] = useState<string | undefined>(undefined);

  const handleConfirm = async () => {
    setError(undefined);
    const result = await onConfirm();
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDismiss();
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('alerting.gma-rule-list.actions.delete-title', 'Delete rule')}
      body={
        <>
          {t(
            'alerting.gma-rule-list.actions.delete-body',
            'Are you sure you want to delete "{{ruleTitle}}"? This action cannot be undone.',
            { ruleTitle }
          )}
          {error && (
            <Alert
              severity="error"
              title={t('alerting.gma-rule-list.actions.delete-error-title', 'Unable to delete rule')}
            >
              {error}
            </Alert>
          )}
        </>
      }
      confirmText={t('alerting.gma-rule-list.actions.delete-confirm', 'Delete')}
      onConfirm={handleConfirm}
      onDismiss={() => {
        setError(undefined);
        onDismiss();
      }}
      disabled={isDeleting}
    />
  );
}
