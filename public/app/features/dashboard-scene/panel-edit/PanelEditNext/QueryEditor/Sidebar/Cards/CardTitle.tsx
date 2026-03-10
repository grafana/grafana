import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// Text component doesn't let us use strikethrough so we use a span with the correct style instead
export const CardTitle = ({ title, isHidden }: { title: string; isHidden: boolean }) => {
  const styles = useStyles2(getStyles);
  return <span className={cx(styles.title, { [styles.hidden]: isHidden })}>{title}</span>;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      color: theme.colors.text.primary,
      ...theme.typography.code,
      fontWeight: theme.typography.fontWeightLight,
    }),

    hidden: css({
      textDecoration: 'line-through',
    }),
  };
}
