import { css, cx, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type Pos } from './KeyboardPopover';

/** Approximate rendered size, used to centre / clamp the pill before layout. */
export const NUDGE_WIDTH = 200;
export const NUDGE_HEIGHT = 28;

interface Props {
  pos: Pos;
  /** True between `/` and the `space` that completes the command. */
  slashPending: boolean;
  onClick: () => void;
}

/**
 * Small pill offered when the user highlights part of the query. It's the only
 * thing shown until they either click it or type the `/` + space command —
 * highlighting alone never opens the full popover.
 */
export function SelectionNudge({ pos, slashPending, onClick }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <button
      className={styles.nudge}
      style={{ left: pos.left, top: pos.top }}
      // Clicking must not move focus out of the textarea before we read its
      // selection — otherwise the highlight we're about to act on is gone.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      data-coauthor-nudge
    >
      <span className={styles.label}>Explain or edit</span>
      <kbd className={cx(styles.key, slashPending && styles.keyActive)}>/</kbd>
      <kbd className={styles.key}>space</kbd>
    </button>
  );
}

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(3px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const getStyles = (theme: GrafanaTheme2) => ({
  nudge: css({
    all: 'unset',
    position: 'absolute',
    zIndex: 21,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1),
    borderRadius: 6,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    animation: `${fadeIn} 0.12s ease`,
    '&:hover': { borderColor: theme.colors.border.strong },
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  key: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    color: theme.colors.text.secondary,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 3,
    padding: '1px 5px',
  }),
  keyActive: css({
    color: theme.colors.primary.contrastText,
    background: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  }),
});
