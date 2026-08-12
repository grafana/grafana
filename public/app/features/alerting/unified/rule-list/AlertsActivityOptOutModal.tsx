import { Trans, t } from '@grafana/i18n';
import { Button, Modal, Stack, Text } from '@grafana/ui';

export interface RevertToOldExperienceModalProps {
  isOpen: boolean;
  onRevert: () => void;
  onSeeAlertActivity: () => void;
  onDismiss: () => void;
}

/**
 * Confirmation modal shown when user clicks "Revert to previous experience".
 * Only shown when switching from NEW to OLD experience.
 * Encourages users to try Alert Activity before reverting.
 */
export function RevertToOldExperienceModal({
  isOpen,
  onRevert,
  onSeeAlertActivity,
  onDismiss,
}: RevertToOldExperienceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title={t('alerting.revert-experience-modal.title', 'Revert to previous experience')}
      onDismiss={onDismiss}
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="alerting.revert-experience-modal.description-line1">
            Considering going back to the previous experience because you&apos;re missing more information on alert
            state?
          </Trans>
        </Text>
        <Text>
          <Trans i18nKey="alerting.revert-experience-modal.description-line2">
            The Alert Activity page is now available to handle operational work for your Grafana-managed alert rules.
            Find out what alerts are firing, explore historical information, filter and group to enhance your triage and
            root cause analysis.
          </Trans>
        </Text>
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onRevert}>
          <Trans i18nKey="alerting.revert-experience-modal.revert-button">Revert to previous experience</Trans>
        </Button>
        <Button variant="primary" onClick={onSeeAlertActivity}>
          <Trans i18nKey="alerting.revert-experience-modal.see-activity-button">See Alert Activity</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
