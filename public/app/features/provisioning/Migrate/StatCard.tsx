import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, type IconName, Text, useStyles2 } from '@grafana/ui';

import { getSharedCardStyles } from './statCardStyles';

export type StatTone = 'neutral' | 'success' | 'info' | 'warning' | 'primary';

interface StatCardProps {
  icon: IconName;
  tone: StatTone;
  big: string;
  subLabel?: string;
  label: string;
  emphasized?: boolean;
}

// Maps each tone to a semantic <Text> color so labels pick up the design
// system's text roles rather than hand-rolled colors.
const toneToTextColor: Record<StatTone, 'primary' | 'success' | 'info' | 'warning'> = {
  neutral: 'primary',
  success: 'success',
  info: 'info',
  warning: 'warning',
  primary: 'primary',
};

export function StatCard({ icon, tone, big, subLabel, label, emphasized }: StatCardProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.card, styles[`statCardSurface_${tone}`], emphasized && styles.statCardEmphasized)}>
      <div className={cx(styles.statCardIcon, styles[`statIconTone_${tone}`])}>
        <Icon name={icon} size="xl" />
      </div>
      <div className={styles.statCardBody}>
        <Text variant="body" weight="medium" color={toneToTextColor[tone]}>
          {label}
        </Text>
        <span className={styles.value}>{big}</span>
        {subLabel && (
          <Text color="secondary" variant="body">
            {subLabel}
          </Text>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  ...getSharedCardStyles(theme),
  statCardSurface_neutral: css({}),
  statCardSurface_success: css({
    background: theme.colors.success.transparent,
    borderColor: theme.colors.success.borderTransparent,
  }),
  statCardSurface_info: css({
    background: theme.colors.info.transparent,
    borderColor: theme.colors.info.borderTransparent,
  }),
  statCardSurface_warning: css({
    background: theme.colors.warning.transparent,
    borderColor: theme.colors.warning.borderTransparent,
  }),
  statCardSurface_primary: css({
    background: theme.colors.primary.transparent,
    borderColor: theme.colors.primary.borderTransparent,
  }),
  statCardEmphasized: css({
    borderColor: theme.colors.warning.border,
    boxShadow: `0 0 0 1px ${theme.colors.warning.borderTransparent}, ${theme.shadows.z1}`,
  }),
  statCardBody: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 0,
  }),
  statCardIcon: css({
    flex: '0 0 auto',
    width: theme.spacing(6),
    height: theme.spacing(6),
    borderRadius: theme.shape.radius.circle,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  statIconTone_neutral: css({
    background: theme.colors.background.canvas,
    color: theme.colors.text.secondary,
  }),
  statIconTone_success: css({
    background: theme.colors.success.transparent,
    color: theme.colors.success.text,
  }),
  statIconTone_info: css({
    background: theme.colors.info.transparent,
    color: theme.colors.info.text,
  }),
  statIconTone_warning: css({
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
  }),
  statIconTone_primary: css({
    background: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
  }),
});
