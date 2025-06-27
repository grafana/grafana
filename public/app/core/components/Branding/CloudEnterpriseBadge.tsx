import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

export function CloudEnterpriseBadge() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Icon name="cloud" size="sm" />
      <Trans i18nKey="cloud-enterprise-feature-badge">Cloud & Enterprise </Trans>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'inline-flex',
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.pill,
      background: theme.colors.gradients.brandHorizontal,
      color: theme.colors.primary.contrastText,
      fontWeight: theme.typography.fontWeightMedium,
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      alignItems: 'center',
    }),
  };
};
