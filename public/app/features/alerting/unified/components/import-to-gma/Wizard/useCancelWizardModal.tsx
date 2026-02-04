import { type JSX, useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';

type CancelModalHook = [
  JSX.Element, // Modal element to render
  () => void, // handleCancel - shows modal or navigates directly
];

interface UseCancelWizardModalOptions {
  redirectUrl?: string;
  isDirty?: boolean;
}

export function useCancelWizardModal({
  redirectUrl = '/alerting/list',
  isDirty = false,
}: UseCancelWizardModalOptions = {}): CancelModalHook {
  const [isOpen, setIsOpen] = useState(false);

  const dismissModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const navigateAway = useCallback(() => {
    locationService.push(redirectUrl);
  }, [redirectUrl]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setIsOpen(true);
    } else {
      navigateAway();
    }
  }, [isDirty, navigateAway]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    navigateAway();
  }, [navigateAway]);

  const modal = useMemo(
    () => (
      <ConfirmModal
        isOpen={isOpen}
        title={t('alerting.import-to-gma.wizard.cancel-confirm-title', 'Cancel import?')}
        body={t(
          'alerting.import-to-gma.wizard.cancel-confirm-body',
          'Are you sure you want to cancel? All your progress will be lost.'
        )}
        confirmText={t('alerting.import-to-gma.wizard.cancel-confirm-yes', 'Discard changes')}
        dismissText={t('alerting.import-to-gma.wizard.cancel-confirm-no', 'Dismiss')}
        icon="exclamation-triangle"
        onConfirm={handleConfirm}
        onDismiss={dismissModal}
      />
    ),
    [isOpen, handleConfirm, dismissModal]
  );

  return [modal, handleCancel];
}
