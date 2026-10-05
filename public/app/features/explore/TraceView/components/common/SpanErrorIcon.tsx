import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

type SpanErrorIconProps = {
  'aria-label'?: string;
  className?: string;
};

export function SpanErrorIcon({ 'aria-label': ariaLabel, className }: SpanErrorIconProps) {
  const styles = useStyles2(getStyles);

  return <Icon name="exclamation-circle" className={cx(styles.icon, className)} aria-label={ariaLabel} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    color: theme.colors.error.text,
    flexShrink: 0,
  }),
});
