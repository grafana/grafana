import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface Props {
  noValue?: string;
}

/** Keeps the "No data" message visible over a plot that only draws thresholds. */
export const NoValuesOverlay = ({ noValue }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.overlay}>
      <span className={styles.message}>{noValue ?? t('timeseries.no-values-overlay.no-data', 'No data')}</span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  overlay: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  }),
  message: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.lg,
    background: theme.colors.background.primary,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
  }),
});
