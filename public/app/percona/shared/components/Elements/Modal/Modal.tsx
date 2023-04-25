import React, { FC, useEffect, ReactNode } from 'react';

import { IconButton, useStyles2 } from '@grafana/ui';

import { getStyles } from './Modal.styles';

export interface ModalWindow {
  onClose: () => void;
  closeOnClickaway?: boolean;
  closeOnEscape?: boolean;
  isVisible: boolean;
  title: ReactNode | string;
}

export const Modal: FC<ModalWindow> = (props) => {
  const { isVisible, children, title, onClose, closeOnClickaway = true, closeOnEscape = true } = props;
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (closeOnEscape) {
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', escapeHandler);

      return () => document.removeEventListener('keydown', escapeHandler);
    }

    return undefined;
  }, [closeOnEscape, onClose]);

  return isVisible ? (
    <div data-testid="modal-wrapper">
      <div
        className={styles.background}
        onClick={closeOnClickaway ? onClose : undefined}
        data-testid="modal-background"
      />
      <div className={styles.body} data-testid="modal-body">
        <div className={styles.modalHeader} data-testid="modal-header">
          {title}
          <div className={styles.modalHeaderClose}>
            <IconButton data-testid="modal-close-button" name="times" size="lg" onClick={onClose} />
          </div>
        </div>
        <div className={styles.content} data-testid="modal-content">
          {children}
        </div>
      </div>
    </div>
  ) : null;
};
