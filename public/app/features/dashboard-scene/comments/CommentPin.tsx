import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  number: number;
  x: number;
  y: number;
  resolved?: boolean;
  onClick?: () => void;
}

export function CommentPin({ number, x, y, resolved, onClick }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <button
      type="button"
      className={styles.pin}
      style={{ left: x, top: y, opacity: resolved ? 0.45 : 1 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {number}
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pin: css({
    position: 'fixed',
    transform: 'translate(-50%, -100%)',
    minWidth: 22,
    height: 22,
    padding: `0 ${theme.spacing(0.75)}`,
    borderRadius: '11px 11px 11px 2px',
    border: `2px solid ${theme.colors.background.primary}`,
    background: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: '18px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: theme.shadows.z2,
    zIndex: 10000,
    '&:hover': {
      background: theme.colors.primary.shade,
    },
  }),
});
