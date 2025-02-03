import { css } from '@emotion/css';
import * as React from 'react';

import { SceneObject } from '@grafana/scenes';
import { Modal, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { OnRowOptionsUpdate, RowOptionsForm } from './RowOptionsForm';

export interface RowOptionsModalProps {
  title: string;
  repeat?: string;
  parent: SceneObject;
  warning?: React.ReactNode;
  onDismiss: () => void;
  onUpdate: OnRowOptionsUpdate;
}

export const RowOptionsModal = ({ repeat, title, parent, onDismiss, onUpdate, warning }: RowOptionsModalProps) => {
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
        warning={warning}
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
