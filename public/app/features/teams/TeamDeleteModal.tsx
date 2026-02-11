import { t, Trans } from '@grafana/i18n';
import { ConfirmModal, Space, Text } from '@grafana/ui';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export const TeamDeleteModal = ({ isOpen, onConfirm, onDismiss }: Props) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      body={
        <>
          <Text element="p">
            <Trans i18nKey="team-list.action.delete-modal-text">This action will delete the team</Trans>
          </Text>
          <Space v={2} />
        </>
      }
      title={t('team-list.action.delete-modal-title', 'Delete')}
      onDismiss={onDismiss}
      onConfirm={onConfirm}
      confirmText={t('team-list.action.confirmation-text', 'Delete')}
    />
  );
};
