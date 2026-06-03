import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// Grafana brand orange used for the Assistant accent, mirroring DashboardCreatorPage.
const BRAND_ORANGE = '#FF8833';

interface Props {
  number: number;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CommentPin({ number, x, y, selected, onClick }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <button
      type="button"
      className={cx(styles.pin, selected && styles.selected)}
      style={{ left: x, top: y }}
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
    transformOrigin: 'bottom left',
    transform: 'translate(-50%, -100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
    height: 26,
    padding: `0 ${theme.spacing(1)}`,
    borderRadius: '13px 13px 13px 3px',
    border: `2px solid ${theme.colors.background.primary}`,
    background: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: 1,
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: `${theme.shadows.z2}, 0 0 0 1px ${theme.colors.primary.shade}`,
    zIndex: 10000,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform', 'background-color', 'box-shadow', 'border-color'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
    '&:hover': {
      background: theme.colors.primary.shade,
      transform: 'translate(-50%, -100%) scale(1.08)',
      boxShadow: `${theme.shadows.z3}, 0 0 0 1px ${theme.colors.primary.shade}`,
    },
    '&:active': {
      transform: 'translate(-50%, -100%) scale(0.96)',
    },
  }),
  // Selected (its thread popover is open): keep the blue fill but add a bold orange border + ring
  // (Grafana brand orange / Assistant accent) so the active pin clearly stands out from the others.
  selected: css({
    borderColor: BRAND_ORANGE,
    boxShadow: `${theme.shadows.z3}, 0 0 0 2px ${BRAND_ORANGE}`,
    transform: 'translate(-50%, -100%) scale(1.08)',
    '&:hover': {
      transform: 'translate(-50%, -100%) scale(1.08)',
    },
  }),
});
