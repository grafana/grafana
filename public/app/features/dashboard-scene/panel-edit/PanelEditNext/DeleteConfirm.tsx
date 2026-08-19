import { css, keyframes } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

export enum ConfirmationStyle {
  compact = 'compact',
  full = 'full',
}

interface DeleteConfirmProps {
  confirmStyle: ConfirmationStyle;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ confirmStyle, description, onConfirm, onCancel }: DeleteConfirmProps) {
  const styles = useStyles2(getStyles);

  const groupAria = t('query-editor-next.action.delete-confirmation-group', 'Delete confirmation');
  const confirmDeleteAria = t('query-editor-next.action.confirm-delete-confirm', 'Confirm');
  const cancelDeleteAria = t('query-editor-next.action.cancel-delete', 'Cancel');
  const confirmTooltip = description ? `${confirmDeleteAria}. ${description}` : confirmDeleteAria;

  const handleConfirmClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onConfirm();
    },
    [onConfirm]
  );

  const handleCancelClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onCancel();
    },
    [onCancel]
  );

  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <div className={styles.cluster} onKeyDownCapture={handleKeyDownCapture} role="group" aria-label={groupAria}>
      {confirmStyle === ConfirmationStyle.full ? (
        <Button
          size="sm"
          variant="destructive"
          aria-label={confirmDeleteAria}
          aria-description={description}
          onClick={handleConfirmClick}
          tooltip={confirmTooltip}
        >
          {t('query-editor-next.action.confirm-delete', 'Delete')}
        </Button>
      ) : (
        <Button
          size="sm"
          fill="text"
          variant="destructive"
          icon="trash-alt"
          className={styles.iconButton}
          aria-label={confirmDeleteAria}
          aria-description={description}
          onClick={handleConfirmClick}
          tooltip={confirmTooltip}
        />
      )}
      <Button
        // Focus the safe action when the destructive prompt appears: lets keyboard users
        // dismiss in one keystroke and ensures Escape (handled at capture phase above) sees
        // the keydown. This is the WAI-ARIA pattern for confirmation dialogs.
        autoFocus
        size="sm"
        fill="text"
        variant="secondary"
        icon="times"
        className={confirmStyle === ConfirmationStyle.compact ? styles.iconButton : undefined}
        aria-label={cancelDeleteAria}
        onClick={handleCancelClick}
        tooltip={cancelDeleteAria}
      />
    </div>
  );
}

// Subtle slide-in mirrors the right-to-left reveal of the sidebar hover actions so the
// cluster feels like it slid out of the trash slot.
const slideIn = keyframes({
  from: { opacity: 0, transform: 'translateX(6px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});

const getStyles = (theme: GrafanaTheme2) => ({
  cluster: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${slideIn} ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeOut}`,
    },
  }),
  iconButton: css({
    minWidth: theme.spacing(3.5),
    justifyContent: 'center',
  }),
});
