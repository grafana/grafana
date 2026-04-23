import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { type StateChip as StateChipKind } from '../lib/types';

interface Props {
  kind: StateChipKind;
  count: number;
  active: boolean;
  onToggle: () => void;
}

export function StateChip({ kind, count, active, onToggle }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cx(styles.chip, active && styles.active, styles[kind])}
    >
      <span className={cx(styles.dot, styles[`${kind}Dot`])} aria-hidden="true" />
      <span className={styles.label}>{labelFor(kind)}</span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}

function labelFor(kind: StateChipKind): string {
  switch (kind) {
    case 'firing':
      return t('alerting.rule-list-v2.state.firing', 'Firing');
    case 'pending':
      return t('alerting.rule-list-v2.state.pending', 'Pending');
    case 'recovering':
      return t('alerting.rule-list-v2.state.recovering', 'Recovering');
    case 'normal':
      return t('alerting.rule-list-v2.state.normal', 'Normal');
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    chip: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1),
      background: 'transparent',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.pill,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    active: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.action.selected,
    }),
    dot: css({
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
    }),
    firing: css({}),
    pending: css({}),
    recovering: css({}),
    normal: css({}),
    firingDot: css({ background: theme.colors.error.main }),
    pendingDot: css({ background: theme.colors.warning.main }),
    recoveringDot: css({ background: theme.colors.info.main }),
    normalDot: css({ background: theme.colors.success.main }),
    label: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    count: css({
      color: theme.colors.text.secondary,
      fontVariantNumeric: 'tabular-nums',
    }),
  };
}
