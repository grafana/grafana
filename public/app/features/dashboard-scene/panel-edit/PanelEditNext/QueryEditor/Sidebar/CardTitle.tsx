import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

// Text component doesn't let us use strikethrough so we use a span with the correct style instead
export const CardTitle = ({ title, isHidden }: { title: string; isHidden: boolean }) => {
  const styles = useStyles2(getStyles, { isHidden });
  return (
    <span className={styles.title}>
      <Text weight="light" variant="code" color="primary" truncate>
        {title}
      </Text>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2, { isHidden }: { isHidden: boolean }) {
  return {
    title: css({
      textDecoration: isHidden ? 'line-through' : 'none',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
