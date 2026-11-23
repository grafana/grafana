import { css } from '@emotion/css';
import { useMemo } from 'react';

import { formattedValueToString, getValueFormat, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { calculateStats } from '../../utils';
import { type LogListModel } from '../panel/processing';

const VALUES_LIMIT = 10;

interface Props {
  field: string;
  id: string;
  logs: LogListModel[];
}

export const FieldValues = ({ field, id, logs }: Props) => {
  const styles = useStyles2(getStyles);

  const values = useMemo(
    () =>
      calculateStats(logs.map((log) => getFieldValue(log, field)))
        .slice(0, VALUES_LIMIT)
        .map((stat) => ({ ...stat, proportion: stat.count / logs.length })),
    [field, logs]
  );

  if (values.length === 0) {
    return (
      <div id={id} className={styles.container}>
        <div className={styles.source}>
          {t('logs.field-selector.field-values.empty', 'No values in the loaded lines')}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...values.map(({ count }) => count));

  return (
    <div id={id} className={styles.container}>
      <ul className={styles.values}>
        {values.map(({ count, proportion, value }) => (
          <li key={value} className={styles.row}>
            <span className={styles.name} title={value}>
              {value}
            </span>
            <span className={styles.count}>{formattedValueToString(getValueFormat('short')(count))}</span>
            <span className={styles.count}>{formattedValueToString(getValueFormat('percentunit')(proportion, 0))}</span>
            <span className={styles.bar}>
              <span className={styles.innerBar} style={{ width: `${(100 * count) / maxCount}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.source}>
        {t('logs.field-selector.field-values.loaded-lines', '', {
          count: logs.length,
          defaultValue_one: 'Top values in {{count}} loaded line',
          defaultValue_other: 'Top values in {{count}} loaded lines',
        })}
      </div>
    </div>
  );
};

function getFieldValue(log: LogListModel, field: string): string | undefined {
  const value = log.labels[field] ?? log.dataFrame.fields.find(({ name }) => name === field)?.values[log.rowIndex];
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

const ROW_HEIGHT = 24;
const BAR_HEIGHT = 2;

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      paddingLeft: theme.spacing(2),
    }),
    values: css({
      listStyle: 'none',
    }),
    row: css({
      alignItems: 'center',
      display: 'flex',
      fontSize: theme.typography.size.sm,
      gap: theme.spacing(0.5),
      height: ROW_HEIGHT,
      padding: theme.spacing(0, 0.5, 0.5),
      position: 'relative',
    }),
    name: css({
      flex: 1,
      minWidth: '40%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    count: css({
      color: theme.colors.text.secondary,
      fontVariantNumeric: 'tabular-nums',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }),
    bar: css({
      background: theme.colors.border.weak,
      bottom: 0,
      height: BAR_HEIGHT,
      left: 0,
      position: 'absolute',
      right: 0,
    }),
    innerBar: css({
      background: theme.colors.primary.main,
      display: 'block',
      height: BAR_HEIGHT,
    }),
    source: css({
      color: theme.colors.text.secondary,
      padding: theme.spacing(0.5, 0.5, 0),
    }),
  };
}
