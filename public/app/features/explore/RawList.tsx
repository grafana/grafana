import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme } from '@grafana/data/src';
import { IconButton, useStyles } from '@grafana/ui/src';


import { instantQueryRawVirtualizedListData } from './TableContainer';

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
    overflow-x:scroll;
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none; /* Firefox */

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }
  `,
  rowHeading: css`
    color: green;
  `,
  rowValue: css`
    padding-left:0.75em;
    font-weight: bold;
  `,
  rowContent: css``,
  metricName: css`
    color: red;
  `,
  metricEquals: css``,
  metricQuote: css``,
  metricValue: css`
  `,
});

interface RawListProps {
  listItemData: instantQueryRawVirtualizedListData;
  listKey: number;
}

type ListValue = {key: string, value: string};

const RawList = ({ listItemData, listKey }: RawListProps) => {
  const { Value, __name__, ...AllLabels } = listItemData;

  const [_, copyToClipboard] = useCopyToClipboard();

  const styles = useStyles(getStyles);

  let attributeValues: ListValue[] = [];

  for (const key in AllLabels) {
    if (key in AllLabels && AllLabels[key]) {
      attributeValues.push({
        key: key,
        value: AllLabels[key]
      })
    }
  }

  /**
   * @todo do we have a method to transform the dataFrame formatting back into valid promQL?
   * @param value
   */
  const transformCopyValue = (value: string): string =>{
    if(value === '∞'){  //negative infinity?
      return '+Inf'
    }
    return value;
  }

  const stringRep = `${__name__}{${attributeValues.map((value) => {
    return `${value.key}="${transformCopyValue(value.value)}"`;
  })}}`;

  return (
    <div key={listKey} className={styles.rowWrapper}>
      <span className={styles.rowLabelWrap}>
        <IconButton tooltip="Copy to clipboard" onClick={() => copyToClipboard(stringRep)} name="copy" />
        <span className={styles.rowHeading}>{__name__}</span>
        <span>{`{`}</span>
        <span className={styles.rowContent}>
          {attributeValues.map((value, index) => (
            <RawListItem value={value} key={index} index={index} length={attributeValues.length} />
          ))}
        </span>
        <span>{`}`}</span>
      </span>
      <span className={styles.rowValue}>{Value}</span>
    </div>
  );
};

export default RawList

/**
 *
 * @param value
 * @param index
 * @param length
 * @constructor
 */
const RawListItem = ({ value, index, length }: { value: ListValue; index: number; length: number }) => {
  const styles = useStyles(getStyles);

  // From the beginning of the string to the start of the `=`
  const attributeName = value.key

  // From after the `="` to before the last `"`
  const attributeValue = value.value

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
