import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

export function ToLabel() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.button}>
      <Trans i18nKey="alerting.threshold.to">TO</Trans>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    height: '32px',
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    alignItems: 'center',
    fontWeight: theme.typography.fontWeightBold,
    padding: `0 ${theme.spacing(1)}`,
  }),
});
