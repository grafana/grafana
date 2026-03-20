/**
 * CollabSaveStatus — replaces the Save button in collab mode with
 * an autosave status pill (Saved / Saving / Edited / Save failed + retry).
 */

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useCollab } from 'app/features/dashboard-collab/useCollab';

import type { ToolbarActionProps } from '../types';

export type SaveStatus = 'saved' | 'saving' | 'edited' | 'failed';

interface StatusConfig {
  label: string;
  styleKey: 'saved' | 'saving' | 'edited' | 'failed';
}

const STATUS_MAP: Record<SaveStatus, StatusConfig> = {
  saved: { label: 'Saved', styleKey: 'saved' },
  saving: { label: 'Saving...', styleKey: 'saving' },
  edited: { label: 'Edited', styleKey: 'edited' },
  failed: { label: 'Save failed', styleKey: 'failed' },
};

/**
 * Derives the save status from collab context and dashboard dirty state.
 * - "saved": connected, not dirty
 * - "edited": connected, dirty (changes pending within quiescence)
 * - "saving": (future: wired to autosave in-progress signal)
 * - "failed": not connected (connection lost)
 */
function useSaveStatus(isDirty: boolean): SaveStatus {
  const { connected } = useCollab();

  if (!connected) {
    return 'failed';
  }

  if (isDirty) {
    return 'edited';
  }

  return 'saved';
}

export function CollabSaveStatus({ dashboard }: ToolbarActionProps) {
  const { isDirty } = dashboard.useState();
  const status = useSaveStatus(Boolean(isDirty));
  const styles = useStyles2(getStyles);

  const { label, styleKey } = STATUS_MAP[status];

  return (
    <div className={cx(styles.pill, styles[styleKey])} data-testid="collab-save-status">
      <span className={styles.dot} />
      <span>{label}</span>
      {status === 'failed' && (
        <button
          className={styles.retryButton}
          onClick={() => dashboard.openSaveDrawer({})}
          type="button"
          data-testid="collab-save-retry"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pill: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.size.sm,
      whiteSpace: 'nowrap',
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
    }),
    dot: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
    }),
    saved: css({
      color: theme.colors.success.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.success.main,
      },
    }),
    saving: css({
      color: theme.colors.warning.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.warning.main,
      },
    }),
    edited: css({
      color: theme.colors.warning.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.warning.main,
      },
    }),
    failed: css({
      color: theme.colors.error.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.error.main,
      },
    }),
    retryButton: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.link,
      cursor: 'pointer',
      padding: 0,
      fontSize: theme.typography.size.sm,
      textDecoration: 'underline',
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
  };
}
