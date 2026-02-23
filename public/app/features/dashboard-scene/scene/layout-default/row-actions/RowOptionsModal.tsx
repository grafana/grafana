import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Modal, useStyles2 } from '@grafana/ui';

import { OnRowOptionsUpdate, RowOptionsForm } from './RowOptionsForm';

export interface RowOptionsModalProps {
  title: string;
  repeat?: string;
  parent: SceneObject;
  isUsingDashboardDS: boolean;
  onDismiss: () => void;
  onUpdate: OnRowOptionsUpdate;
}

export const RowOptionsModal = ({
  repeat,
  title,
  parent,
  onDismiss,
  onUpdate,
  isUsingDashboardDS,
}: RowOptionsModalProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal
      isOpen={true}
      title={t('dashboard.default-layout.row-options.modal.title', 'Row options')}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <RowOptionsForm
        sceneContext={parent}
        repeat={repeat}
        title={title}
        onCancel={onDismiss}
        onUpdate={onUpdate}
        isUsingDashboardDS={isUsingDashboardDS}
      />
    </Modal>
  );
};

const getStyles = () => ({
  modal: css({
    label: 'RowOptionsModal',
    width: '500px',
  }),
});
