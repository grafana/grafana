import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, Text, useStyles2 } from '@grafana/ui';

import { percent } from './stats';

type ResourceTone = 'success' | 'info' | 'warning';

interface ResourceStatusCardProps {
  /** Resource type label, e.g. "Dashboards" or "Folders". */
  label: string;
  managed: number;
  total: number;
}

/**
 * Migration status for a resource type, used to colour the card:
 * nothing managed yet → warning, partially managed → info, fully managed →
 * success.
 */
export function resourceTone(managed: number, total: number): ResourceTone {
  if (managed >= total) {
    return 'success';
  }
  if (managed === 0) {
    return 'warning';
  }
  return 'info';
}

/**
 * A single card per resource type (dashboards, folders, …) that surfaces how
 * much of it is managed and changes colour with that status.
 */
export function ResourceStatusCard({ label, managed, total }: ResourceStatusCardProps) {
  const styles = useStyles2(getStyles);

  // Nothing of this resource type exists, so there's nothing to migrate; hide
  // the card rather than show an empty 0-of-0.
  if (total === 0) {
    return null;
  }

  const tone = resourceTone(managed, total);

  return (
    <Card noMargin className={cx(styles.card, styles[`surface_${tone}`])}>
      <Card.Heading>
        <Text variant="body" weight="medium" color={tone}>
          {label}
        </Text>
      </Card.Heading>
      <span className={styles.value}>{percent(managed, total)}</span>
      <Text color="secondary" variant="body">
        {t('provisioning.migrate.n-of-m-managed', '{{managed}} of {{total}} managed', { managed, total })}
      </Text>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Card lays its slots out on a grid; the doubled selector raises specificity
  // so we can override it into a left-aligned column and tint the surface.
  card: css({
    '&&': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.25),
      padding: theme.spacing(1.5),
      border: `1px solid ${theme.colors.border.medium}`,
    },
  }),
  surface_success: css({
    '&&': {
      background: theme.colors.success.transparent,
      borderColor: theme.colors.success.borderTransparent,
    },
  }),
  surface_info: css({
    '&&': {
      background: theme.colors.info.transparent,
      borderColor: theme.colors.info.borderTransparent,
    },
  }),
  surface_warning: css({
    '&&': {
      background: theme.colors.warning.transparent,
      borderColor: theme.colors.warning.borderTransparent,
    },
  }),
  value: css({
    fontSize: theme.typography.pxToRem(28),
    lineHeight: 1.1,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
  }),
});
