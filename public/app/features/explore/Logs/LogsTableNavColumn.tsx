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
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
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
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        maxWidth: '100%',
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

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
function sortLabels(labels: Record<string, fieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    if (la != null && lb != null) {
      return (
        Number(lb.type === 'TIME_FIELD') - Number(la.type === 'TIME_FIELD') ||
        Number(lb.type === 'BODY_FIELD') - Number(la.type === 'BODY_FIELD') ||
        collator.compare(a, b)
      );
    }
    // otherwise do not sort
    return 0;
  };
}

export const LogsTableNavColumn = (props: {
  labels: Record<string, fieldNameMeta>;
  valueFilter: (value: string) => boolean;
  toggleColumn: (columnName: string) => void;
}): JSX.Element => {
  const { labels, valueFilter, toggleColumn } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));
  if (labelKeys.length) {
    return (
      <div className={styles.columnWrapper}>
        {labelKeys.sort(sortLabels(labels)).map((labelName) => (
          <div
            title={`${labelName} appears in ${labels[labelName]?.percentOfLinesWithLabel}% of log lines`}
            className={styles.wrap}
            key={labelName}
          >
            <Checkbox
              className={styles.checkboxLabel}
              label={labelName}
              onChange={() => toggleColumn(labelName)}
              checked={labels[labelName]?.active ?? false}
            />
            <button className={styles.labelCount} onClick={() => toggleColumn(labelName)}>
              {labels[labelName]?.percentOfLinesWithLabel}%
            </button>
          </div>
        ))}
      </div>
    );
  }

  return <div className={styles.empty}>No fields</div>;
};
