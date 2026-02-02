import { css } from '@emotion/css';

import { ConfirmModal } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  varName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmDeleteModal({ varName, isOpen = false, onConfirm, onDismiss }: Props) {
  return (
    <ConfirmModal
      title={t(
        'bmcgrafana.dashboards.settings.variables.variables-tab.delete.delete-variable-title',
        'Delete variable'
      )}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      body={t(
        'bmcgrafana.dashboards.settings.variables.variables-tab.delete.body',
        'Are you sure you want to delete variable "{{varName}}"?',
        { varName }
      )}
      modalClass={styles.modal}
      confirmText={t('bmcgrafana.dashboards.settings.variables.variables-tab.delete.delete-confirm-text', 'Delete')}
    />
  );
}

const styles = {
  modal: css({
    width: 'max-content',
    maxWidth: '80vw',
  }),
};
