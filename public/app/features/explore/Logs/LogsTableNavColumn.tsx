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
    // Making the checkbox sticky and label scrollable for labels that are wider then the container
    // However, the checkbox component does not support this, so we need to do some css hackery for now until the API of that component is updated.
    checkboxLabel: css({
      '> :first-child': {
        position: 'sticky',
        left: 0,
        bottom: 0,
        top: 0,
      },
      '> span': {
        overflow: 'scroll',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        '&::-moz-scrollbar': {
          display: 'none',
        },
      },
    }),
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

function sortLabels(labels: Record<string, fieldNameMeta>) {
  return (a: string, b: string) => {
    // First sort by active
    if (labels[a].active && labels[b].active) {
      // If both fields are active, sort time first
      if (labels[a]?.type === 'TIME_FIELD') {
        return -1;
      }
      if (labels[b]?.type === 'TIME_FIELD') {
        return 1;
      }
      // And then line second
      if (labels[a]?.type === 'BODY_FIELD') {
        return -1;
      }
      // special fields are next
      if (labels[b]?.type === 'BODY_FIELD') {
        return 1;
      }
    }

    // If just one label is active, sort it first
    if (labels[b].active) {
      return 1;
    }
    if (labels[a].active) {
      return -1;
    }

    // If both fields are special, and not selected, sort time first
    if (labels[a]?.type && labels[b]?.type) {
      if (labels[a]?.type === 'TIME_FIELD') {
        return -1;
      }
      return 0;
    }

    // If only one special field, stick to the top of inactive fields
    if (labels[a]?.type && !labels[b]?.type) {
      return -1;
    }
    // if the b field is special, sort it first
    if (!labels[a]?.type && labels[b]?.type) {
      return 1;
    }

    // Finally sort by percent enabled, this could have conflicts with the special fields above, except they are always on 100% of logs
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }

    // otherwise do not sort
    return 0;
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
        {labelKeys.sort(sortLabels(labels)).map((labelName) => (
          <div className={styles.wrap} key={labelName}>
            <Checkbox
              className={styles.checkboxLabel}
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
