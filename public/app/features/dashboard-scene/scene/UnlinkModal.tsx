import { ConfirmModal } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const UnlinkModal = ({ isOpen, onConfirm, onDismiss }: Props) => {
  return (
    <ConfirmModal
      // BMC Change: Next prop
      title={t('bmcgrafana.library-panels.unlink.title', 'Do you really want to unlink this panel?')}
      icon="question-circle"
      // BMC Change: Next prop
      body={t(
        'bmcgrafana.library-panels.unlink.body',
        'If you unlink this panel, you will be able to edit it without affecting any other dashboards. However, once you make a change you will not be able to revert to its original reusable panel.'
      )}
      // BMC Change: Next prop
      confirmText={t('bmcgrafana.library-panels.unlink.confirmation-text', 'Yes, unlink')}
      onConfirm={() => {
        onConfirm();
        onDismiss();
      }}
      onDismiss={onDismiss}
      isOpen={isOpen}
    />
  );
};
