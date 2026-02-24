import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_COLORS } from '../../constants';

// Text component doesn't let us use strikethrough so we use a span with the correct style instead
export const CardTitle = ({ title, isHidden, isError }: { title: string; isHidden: boolean; isError?: boolean }) => {
  const styles = useStyles2(getStyles);
  return <span className={cx(styles.title, { [styles.error]: isError, [styles.hidden]: isHidden })}>{title}</span>;
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

    error: css({
      color: QUERY_EDITOR_COLORS.error,
    }),

    hidden: css({
      textDecoration: 'line-through',
    }),
  };
}
