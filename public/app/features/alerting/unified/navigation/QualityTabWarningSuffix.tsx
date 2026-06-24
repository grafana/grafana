import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

/**
 * Warning indicator rendered to the right of the "Quality" tab label when one or more
 * alert rules are missing actionable annotations.
 */
export function QualityTabWarningSuffix({ className }: { className?: string }) {
  const styles = useStyles2(getStyles);
  return (
    <Icon
      name="exclamation-triangle"
      className={cx(styles.warning, className)}
      title={t('alerting.quality.needs-attention', 'Some alert rules are missing required details')}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  warning: css({
    color: theme.colors.warning.text,
  }),
});
