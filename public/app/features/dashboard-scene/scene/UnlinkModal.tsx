import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const UnlinkModal = ({ isOpen, onConfirm, onDismiss }: Props) => {
  return (
    <ConfirmModal
      title={t('dashboard-scene.unlink-modal.title-really-unlink-panel', 'Do you really want to unlink this panel?')}
      body={t(
        'dashboard-scene.unlink-modal.body-unlink-panel',
        'If you unlink this panel, you will be able to edit it without affecting any other dashboards. Once you save the dashboard, you will not be able to link it to the reusable panel again.'
      )}
      confirmText={t('dashboard-scene.unlink-modal.confirmText-yes-unlink', 'Yes, unlink')}
      onConfirm={() => {
        onConfirm();
        onDismiss();
      }}
      onDismiss={onDismiss}
      isOpen={isOpen}
    />
  );
};
