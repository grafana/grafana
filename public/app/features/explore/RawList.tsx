import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme } from '@grafana/data/src';
import { IconButton, useStyles } from '@grafana/ui/src';

import RawListItem from './RawListItem';
import { instantQueryRawVirtualizedListData } from './TableContainer';

interface RawListProps {
  listItemData: instantQueryRawVirtualizedListData;
  listKey: number;
}

export type RawListValue = { key: string; value: string };

/* @todo replace mockup styles */
const getStyles = (theme: GrafanaTheme) => ({
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
});

const RawList = ({ listItemData, listKey }: RawListProps) => {
  const { Value, __name__, ...AllLabels } = listItemData;

  const [_, copyToClipboard] = useCopyToClipboard();

  const styles = useStyles(getStyles);

  let attributeValues: RawListValue[] = [];

  for (const key in AllLabels) {
    if (key in AllLabels && AllLabels[key]) {
      attributeValues.push({
        key: key,
        value: AllLabels[key],
      });
    }
  }

  /**
   * @todo do we have a method to transform the dataFrame formatting back into valid promQL?
   * @param value
   */
  const transformCopyValue = (value: string): string => {
    if (value === '∞') {
      //negative infinity?
      return '+Inf';
    }
    return value;
  };

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

export default RawList;
