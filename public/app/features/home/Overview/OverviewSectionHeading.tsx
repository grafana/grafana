import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Counter, Stack, useStyles2 } from '@grafana/ui';

export type OverviewSectionHeadingVariant = 'success' | 'warning' | 'default';

interface OverviewSectionHeadingProps {
  children: NonNullable<ReactNode>;
  count?: number;
  variant?: OverviewSectionHeadingVariant;
}

export function OverviewSectionHeading({ children, count, variant = 'default' }: OverviewSectionHeadingProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="center">
      {variant !== 'default' && <span className={cx(styles.statusDot, styles[variant])} aria-hidden="true" />}
      <Stack direction="row" gap={0} alignItems="center">
        {children}
        {count !== undefined && <Counter value={count} />}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statusDot: css({
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.circle,
    flexShrink: 0,
  }),
  warning: css({ background: theme.colors.warning.main }),
  success: css({ background: theme.colors.success.main }),
});
