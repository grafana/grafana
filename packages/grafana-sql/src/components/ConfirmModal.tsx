import { css } from '@emotion/css';
import { useRef, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';

type ConfirmModalProps = {
  isOpen: boolean;
  onCancel?: () => void;
  onDiscard?: () => void;
  onCopy?: () => void;
};
export function ConfirmModal({ isOpen, onCancel, onDiscard, onCopy }: ConfirmModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const styles = useStyles2(getStyles);

  // Moved from grafana/ui
  useEffect(() => {
    // for some reason autoFocus property did no work on this button, but this does
    if (isOpen) {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <Modal
      title={
        <div className={styles.modalHeaderTitle}>
          <Icon name="exclamation-triangle" size="lg" />
          <span className={styles.titleText}>Warning</span>
        </div>
      }
      onDismiss={onCancel}
      isOpen={isOpen}
    >
      <p>
        Builder mode does not display changes made in code. The query builder will display the last changes you made in
        builder mode.
      </p>
      <p>Do you want to copy your code to the clipboard?</p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" type="button" onClick={onDiscard} ref={buttonRef}>
          Discard code and switch
        </Button>
        <Button variant="primary" onClick={onCopy}>
          Copy code and switch
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  titleText: css({
    paddingLeft: theme.spacing(2),
  }),
  modalHeaderTitle: css({
    fontSize: theme.typography.size.lg,
    float: 'left',
    paddingTop: theme.spacing(1),
    margin: theme.spacing(0, 2),
  }),
});
