import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

export const StPodTimeoutBanner = () => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="st-pod-timeout-banner" className={styles.banner} role="status">
      <Icon name="info-circle" size="md" className={styles.icon} />
      <Text variant="bodySmall" color="secondary">
        {t('st-pod-ready.timeout.banner', "Hang tight. This is taking a bit longer than expected, but we're on it.")}
      </Text>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z1,
    maxWidth: 'min(480px, calc(100% - 32px))',
  }),
  icon: css({
    color: theme.colors.warning.main,
    flexShrink: 0,
  }),
});
