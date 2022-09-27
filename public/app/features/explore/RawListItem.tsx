import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data/src';
import { useStyles } from '@grafana/ui/src';

import { RawListValue } from './RawList';

/* @todo replace mockup styles */
const getStyles = (theme: GrafanaTheme) => ({
  rowsWrapper: css`
    width: 100%;
  `,
  rowWrapper: css`
    border-bottom: 1px solid #ccc;
    display: flex;
    justify-content: space-between;
    padding: 10px 6px;
  `,
  rowLabelWrap: css`
    display: flex;
    white-space: nowrap;
    overflow-x: scroll;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }
  `,
  rowHeading: css`
    color: green;
  `,
  rowValue: css`
    padding-left: 0.75em;
    font-weight: bold;
  `,
  rowContent: css``,
  metricName: css`
    color: red;
  `,
  metricEquals: css``,
  metricQuote: css``,
  metricValue: css``,
});

const RawListItem = ({ value, index, length }: { value: RawListValue; index: number; length: number }) => {
  const styles = useStyles(getStyles);

  // From the beginning of the string to the start of the `=`
  const attributeName = value.key;

  // From after the `="` to before the last `"`
  const attributeValue = value.value;

  return (
    <span key={index}>
      <span className={styles.metricName}>{attributeName}</span>
      <span className={styles.metricEquals}>=</span>
      <span className={styles.metricQuote}>&quot;</span>
      <span className={styles.metricValue}>{attributeValue}</span>
      <span className={styles.metricQuote}>&quot;</span>
      {index < length - 1 && <span>, </span>}
    </span>
  );
};

export default RawListItem;
