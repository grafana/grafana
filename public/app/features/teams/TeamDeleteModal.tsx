import { t, Trans } from '@grafana/i18n';
import { Alert, ConfirmModal, Space, Text } from '@grafana/ui';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  teamName: string;
  ownedFolder: boolean;
}

export const TeamDeleteModal = ({ isOpen, onConfirm, onDismiss, teamName, ownedFolder }: Props) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('teams.team-list.columns.delete-modal.title', 'Delete')}
      body={
        <>
          <Text element="p">
            <Trans i18nKey="teams.team-list.columns.delete-modal-text" values={{ teamName: teamName }}>
              This action will delete the team &quot;
              <Text variant="code" weight="bold">
                {'{{ teamName }}'}
              </Text>
              &quot;.
            </Trans>
          </Text>
          <Space v={2} />
        </>
      }
      description={
        <>
          {ownedFolder ? (
            <Alert
              severity="warning"
              title={t('teams.team-list.columns.delete-modal-invalid-title', 'Cannot delete team')}
            >
              <Trans i18nKey="teams.team-list.columns.delete-modal-invalid-text">
                This team is the owner of one or more folders. Remove ownership first in order to proceed.
              </Trans>
            </Alert>
          ) : null}
        </>
      }
      onDismiss={onDismiss}
      onConfirm={onConfirm}
      confirmText={t('teams.team-list.columns.delete-modal.confirm-button', 'Delete')}
      disabled={ownedFolder}
    />
  );
};
