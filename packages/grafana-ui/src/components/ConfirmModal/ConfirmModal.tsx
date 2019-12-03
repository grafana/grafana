import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { Modal } from '../Modal/Modal';
import { Icon } from '../Icon/Icon';
import { IconType } from '../Icon/types';
import { Button } from '../Button/Button';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  modal: css`
    width: 500px;
  `,
  modalHeaderTitle: css`
    font-size: ${theme.typography.heading.h3};
    padding-top: calc(${theme.spacing.d} * 0.75);
    margin: 0 calc(${theme.spacing.d} * 3) 0 calc(${theme.spacing.d} * 1.5);
  `,
  modalHeaderIcon: css`
    font-size: inherit;
    &:before {
      vertical-align: baseline;
    }
  `,
  modalHeaderText: css`
    padding-left: 14px;
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
    <Modal
      className={styles.modal}
      title={
        <h2 className={styles.modalHeaderTitle}>
          <Icon name={icon || defaultIcon} className={styles.modalHeaderIcon} />
          <span className={styles.modalHeaderText}>{title}</span>
        </h2>
      }
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
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
