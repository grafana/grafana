import React, { useCallback, useLayoutEffect, useRef, useState, FC } from 'react';

import { ClipboardButton, Icon, Button, Modal, IconName, useStyles2 } from '@grafana/ui';

import { ProgressModalHeader } from '../../components';
import { useClickOutside } from '../../hooks';
import { ProgressModalProps } from '../../types';

import { Messages } from './ProgressModal.messages';
import { getStyles } from './ProgressModal.styles';

export const ProgressModal: FC<ProgressModalProps> = ({
  version,
  errorMessage = '',
  isOpen = false,
  isUpdated = false,
  output = '',
  updateFailed = false,
}) => {
  const styles = useStyles2(getStyles);
  const outputRef = useRef<HTMLPreElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isOutputShown, setIsOutputShown] = useState(true);

  useClickOutside(modalRef, () => {
    if (isUpdated) {
      // @ts-ignore
      // eslint-disable-next-line no-restricted-globals
      location.reload(true);
    }
  });

  useLayoutEffect(() => {
    // scroll upgrade status to the end.
    const interval = setInterval(() => outputRef.current?.scrollIntoView(false), 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleToggleShowOutput = () => {
    setIsOutputShown((isOutputShown) => !isOutputShown);
  };

  const reloadAfterUpdate = () => {
    // @ts-ignore
    // eslint-disable-next-line no-restricted-globals
    location.reload(true);
  };

  const copyToClipboard = useCallback(() => outputRef.current?.textContent ?? '', [outputRef]);

  const chevronIcon: IconName = isOutputShown ? 'angle-down' : 'angle-up';

  // TODO (nicolalamacchia): componentize this further
  return (
    <Modal title="" isOpen={isOpen}>
      <div ref={modalRef} className={styles.modal} role="document" data-testid="progress-modal-container">
        <ProgressModalHeader isUpdated={isUpdated} updateFailed={updateFailed} errorMessage={errorMessage} />
        {!isUpdated ? (
          <div className={styles.outputContent}>
            <div className={styles.outputHeader}>
              <Icon
                className={styles.outputVisibilityToggle}
                data-testid={`modal-chevron-icon-${chevronIcon}`}
                name={chevronIcon}
                onClick={handleToggleShowOutput}
              />
              <span>{Messages.log}</span>
              <ClipboardButton
                getText={copyToClipboard}
                className={styles.clipboardButton}
                variant="secondary"
                size="sm"
              >
                {Messages.copyToClipboard}
              </ClipboardButton>
            </div>
            {isOutputShown && (
              <div className={styles.output}>
                <pre data-testid="modal-output-pre" ref={outputRef}>
                  {output}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={styles.successNote}>
              <h6 data-testid="modal-update-success-text">
                {Messages.updateSuccessNotice} {version}
              </h6>
            </div>
            <Button
              className={styles.closeModal}
              data-testid="modal-close"
              variant="primary"
              onClick={reloadAfterUpdate}
            >
              {Messages.close}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};
