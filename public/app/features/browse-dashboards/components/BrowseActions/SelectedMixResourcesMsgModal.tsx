import { css } from '@emotion/css';

import { Trans, t } from '@grafana/i18n';
import { Modal, useStyles2 } from '@grafana/ui';

export interface Props {}

export const SelectedMixResourcesMsgModal = ({ onDismiss }: { onDismiss: () => void }) => {
  const styles = useStyles2(getStyles);
  return (
    <Modal
      title={t('browse-dashboards.action.selected-mix-resources-modal-title', 'Mixed resource types selected')}
      isOpen={true}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <Trans i18nKey="browse-dashboards.action.selected-mix-resources-modal-text">
        You have selected both provisioned and non-provisioned resources. These cannot be processed together. Please
        select only provisioned resources or only non-provisioned resources and try again.
      </Trans>
    </Modal>
  );
};

const getStyles = () => ({
  modal: css({
    label: 'RowOptionsModal',
    width: '500px',
  }),
});
