import { css } from '@emotion/css';
import { type RefObject, useRef, useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Icon, Modal, useStyles2 } from '@grafana/ui';

type ConfirmModalProps = {
  isOpen: boolean;
  copyFailed?: boolean;
  isCopying?: boolean;
  onCancel?: () => void;
  onDiscard?: () => void;
  onCopy?: (appendTo: RefObject<HTMLElement | null>) => void;
};
export function ConfirmModal({ isOpen, copyFailed, isCopying, onCancel, onDiscard, onCopy }: ConfirmModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const copyContainerRef = useRef<HTMLDivElement>(null);
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
          <span className={styles.titleText}>
            <Trans i18nKey="grafana-sql.components.confirm-modal.warning">Warning</Trans>
          </span>
        </div>
      }
      ariaLabel={t('grafana-sql.components.confirm-modal.warning', 'Warning')}
      onDismiss={onCancel}
      isOpen={isOpen}
    >
      <p>
        <Trans i18nKey="grafana-sql.components.confirm-modal.builder-mode">
          Builder mode does not display changes made in code. The query builder will display the last changes you made
          in builder mode.
        </Trans>
      </p>
      <div ref={copyContainerRef}>
        <p>
          <Trans i18nKey="grafana-sql.components.confirm-modal.clipboard">
            Do you want to copy your code to the clipboard?
          </Trans>
        </p>
      </div>
      {copyFailed && (
        <Alert
          severity="error"
          title={t(
            'grafana-sql.components.confirm-modal.copy-failed',
            'Could not copy SQL to the clipboard. Your code has not been changed.'
          )}
        />
      )}
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
          <Trans i18nKey="grafana-sql.components.confirm-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="destructive" type="button" onClick={onDiscard} ref={buttonRef}>
          <Trans i18nKey="grafana-sql.components.confirm-modal.discard-code-and-switch">Discard code and switch</Trans>
        </Button>
        <Button variant="primary" onClick={() => onCopy?.(copyContainerRef)} disabled={isCopying}>
          <Trans i18nKey="grafana-sql.components.confirm-modal.copy-code-and-switch">Copy code and switch</Trans>
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
