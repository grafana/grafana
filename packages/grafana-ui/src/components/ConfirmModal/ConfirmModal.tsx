import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { Modal } from '../Modal/Modal';
import { IconType } from '../Icon/types';
import { Button } from '../Button/Button';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  modal: css`
    width: 500px;
  `,
  modalContent: css`
    text-align: center;
  `,
  modalText: css`
    font-size: ${theme.typography.heading.h4};
    color: ${theme.colors.link};
    margin-bottom: calc(${theme.spacing.d} * 2);
    padding-top: ${theme.spacing.d};
  `,
  modalButtonRow: css`
    margin-bottom: 14px;
    a,
    button {
      margin-right: ${theme.spacing.d};
    }
  `,
}));

const defaultIcon: IconType = 'exclamation-triangle';

interface Props {
  isOpen: boolean;
  title: string;
  body: string;
  confirmText: string;
  icon?: IconType;

  onConfirm(): void;
  onDismiss(): void;
}

export const ConfirmModal: FC<Props> = ({ isOpen, title, body, confirmText, icon, onConfirm, onDismiss }) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <Modal className={styles.modal} title={title} icon={icon || defaultIcon} isOpen={isOpen} onDismiss={onDismiss}>
      <div className={styles.modalContent}>
        <div className={styles.modalText}>{body}</div>
        <div className={styles.modalButtonRow}>
          <Button variant="danger" onClick={onConfirm}>
            {confirmText}
          </Button>
          <Button variant="inverse" onClick={onDismiss}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
