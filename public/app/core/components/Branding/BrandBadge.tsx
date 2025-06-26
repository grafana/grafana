import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';
import * as React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  icon?: IconName;
}

export const BrandBadge = React.memo<BadgeProps>(({ icon, children, className, ...otherProps }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </div>
  );
});

BrandBadge.displayName = 'BrandBadge';

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
