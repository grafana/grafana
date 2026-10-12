import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { dateTimeFormatTimeAgoShort } from '@grafana/data/internal';
import { Text, useStyles2 } from '@grafana/ui';

/** Right-aligned fixed-width relative-time cell (`11m ago`) so times line up across rows; blank without a date. */
export function TimeAgoCell({ date }: { date?: Date | number }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.age}>
      {date !== undefined && (
        <Text color="secondary" variant="bodySmall">
          {dateTimeFormatTimeAgoShort(date)}
        </Text>
      )}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
    // Just fits "11mo ago"; a fixed width keeps the neighbouring column from jumping between rows.
    minWidth: theme.spacing(6.5),
    display: 'inline-flex',
    justifyContent: 'flex-end',
  }),
});
