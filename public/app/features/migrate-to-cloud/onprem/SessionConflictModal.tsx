import { useCallback } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Modal, Stack, Text } from '@grafana/ui';

import { type SessionConflictDetails, sessionWorkflowLabel } from '../api/sessionConflict';

interface SessionConflictModalProps {
  conflict: SessionConflictDetails;
  isLoading?: boolean;
  onDismiss: () => void;
  onRefresh: () => void;
  onProceed: () => void;
}

export function SessionConflictModal({
  conflict,
  isLoading = false,
  onDismiss,
  onRefresh,
  onProceed,
}: SessionConflictModalProps) {
  const handleProceed = useCallback(() => {
    onProceed();
  }, [onProceed]);

  return (
    <Modal
      title={t('migrate-to-cloud.session-conflict.title', 'Migration already in progress')}
      isOpen={true}
      onDismiss={onDismiss}
      closeOnBackdropClick={false}
    >
      <Stack direction="column" gap={2}>
        <Text element="p">{conflict.message}</Text>
        <Text element="p" color="secondary">
          {t(
            'migrate-to-cloud.session-conflict.description',
            'The session is currently {{operation}}. Refresh to check the latest status, or proceed to cancel the previous operation and continue.',
            { operation: sessionWorkflowLabel(conflict.workflow) }
          )}
        </Text>

        <Stack direction="row" gap={1} justifyContent="flex-end">
          <Button variant="secondary" onClick={onDismiss} disabled={isLoading}>
            <Trans i18nKey="migrate-to-cloud.session-conflict.cancel">Cancel</Trans>
          </Button>
          <Button variant="secondary" onClick={onRefresh} disabled={isLoading}>
            <Trans i18nKey="migrate-to-cloud.session-conflict.refresh">Refresh status</Trans>
          </Button>
          {conflict.canForce && (
            <Button variant="primary" onClick={handleProceed} disabled={isLoading}>
              <Trans i18nKey="migrate-to-cloud.session-conflict.proceed">Proceed anyway</Trans>
            </Button>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
