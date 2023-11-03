import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Checkbox, useTheme2 } from '@grafana/ui/src';

import { fieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
    }),
    wrap: css({
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      justifyContent: 'space-between',
    }),
    checkbox: css({}),
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
    empty: css({
      marginBottom: theme.spacing(2),
      marginLeft: theme.spacing(1.75),
      fontSize: theme.typography.fontSize,
    }),
  };
}

export const LogsTableNavColumn = (props: {
  labels: Record<string, fieldNameMeta>;
  valueFilter: (value: number) => boolean;
  toggleColumn: (columnName: string) => void;
}): JSX.Element => {
  const { labels, valueFilter, toggleColumn } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labels[labelName].percentOfLinesWithLabel));
  if (labelKeys.length) {
    return (
      <div className={styles.columnWrapper}>
        {labelKeys.map((labelName) => (
          <div className={styles.wrap} key={labelName}>
            <Checkbox
              className={styles.checkbox}
              label={labelName}
              onChange={() => toggleColumn(labelName)}
              checked={labels[labelName]?.active ?? false}
            />
            <span className={styles.labelCount}>({labels[labelName]?.percentOfLinesWithLabel}%)</span>
          </div>
        ))}
      </div>
    );
  }

  return <div className={styles.empty}>No fields</div>;
};
