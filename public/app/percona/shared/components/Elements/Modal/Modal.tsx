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

export const Modal: FC<React.PropsWithChildren<ModalWindow>> = (props) => {
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
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={styles.background}
        onClick={closeOnClickaway ? onClose : undefined}
        data-testid="modal-background"
      />
      <div className={styles.body} data-testid="modal-body">
        <div className={styles.modalHeader} data-testid="modal-header">
          {title}
          <div className={styles.modalHeaderClose}>
            <IconButton
              data-testid="modal-close-button"
              name="times"
              size="lg"
              onClick={onClose}
              aria-label="Close modal"
            />
          </div>
        </div>
        <div className={styles.content} data-testid="modal-content">
          {children}
        </div>
      </div>
    </div>
  ) : null;
};
