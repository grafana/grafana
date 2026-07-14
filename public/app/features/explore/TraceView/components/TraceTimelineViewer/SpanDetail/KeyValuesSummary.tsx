import { css } from '@emotion/css';

import { type GrafanaTheme2, type TraceKeyValuePair } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';

export type KeyValuesSummaryProps = {
  data?: TraceKeyValuePair[] | null;
};

export function KeyValuesSummary({ data = null }: KeyValuesSummaryProps) {
  const styles = useStyles2(getStyles);

  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  return (
    <ul className={styles.summary}>
      {data.map((item, i) => (
        // `i` is necessary in the key because item.key can repeat
        <li className={styles.summaryItem} key={`${item.key}-${i}`}>
          <span className={styles.summaryLabel}>{item.key}</span>
          {String(item.value)}
        </li>
      ))}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    summary: css({
      label: 'summary',
      display: 'inline',
      listStyle: 'none',
      padding: 0,
    }),
    summaryItem: css({
      label: 'summaryItem',
      display: 'inline',
      paddingRight: '0.5rem',
      '&:last-child': {
        paddingRight: 0,
        borderRight: 'none',
      },
    }),
    summaryLabel: css({
      label: 'summaryLabel',
      color: autoColor(theme, '#777'),
      paddingRight: '0.5rem',
    }),
  };
};
