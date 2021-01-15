import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { Modal } from '../Modal/Modal';
import { IconName } from '../../types/icon';
import { Button } from '../Button';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { HorizontalGroup } from '..';

export interface Props {
  /** Toggle modal's open/closed state */
  isOpen: boolean;
  /** Title for the modal header */
  title: string;
  /** Modal content */
  body: React.ReactNode;
  /** Text for confirm button */
  confirmText: string;
  /** Text for dismiss button */
  dismissText?: string;
  /** Icon for the modal header */
  icon?: IconName;
  /** Confirm action callback */
  onConfirm(): void;
  /** Dismiss action callback */
  onDismiss(): void;
}

export const ConfirmModal: FC<Props> = ({
  isOpen,
  title,
  body,
  confirmText,
  dismissText = 'Cancel',
  icon = 'exclamation-triangle',
  onConfirm,
  onDismiss,
}) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <Modal className={styles.modal} title={title} icon={icon} isOpen={isOpen} onDismiss={onDismiss}>
      <div className={styles.modalContent}>
        <div className={styles.modalText}>{body}</div>
        <HorizontalGroup justify="center">
          <Button variant="destructive" onClick={onConfirm}>
            {confirmText}
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            {dismissText}
          </Button>
        </HorizontalGroup>
      </div>
    </Modal>
  );
};

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
}));
