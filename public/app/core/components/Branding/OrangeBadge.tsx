import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLDivElement> {
  text?: string;
  className?: string;
}

export function OrangeBadge({ text, className, ...htmlProps }: Props) {
  const styles = useStyles2(getStyles, text);
  return (
    <div className={cx(styles.wrapper, className)} {...htmlProps}>
      <Icon name="cloud" size="sm" />
      {text}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, text: string | undefined) => {
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
      ...(text === undefined && {
        svg: {
          marginRight: 0,
        },
      }),
    }),
  };
};
