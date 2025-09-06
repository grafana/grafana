import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export function OrangeBadge({ text, className }: { text?: string; className?: string }) {
  const styles = useStyles2(getStyles, text);
  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
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
