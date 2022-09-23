import React from 'react';
import { IconButton, useStyles } from '@grafana/ui/src';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data/src';
import { useCopyToClipboard } from 'react-use';

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    height: 100%;
    overflow: scroll;
  `,
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
  `,
  rowHeading: css`
    color: green;
  `,
  rowValue: css``,
  rowContent: css``,
  metricName: css`
    /* @todo replace mockup styles */
    color: red;
  `,
  metricEquals: css``,
  metricQuote: css``,
  metricValue: css`
    /* @todo replace mockup styles */
    font-weight: bold;
  `,
});

type ListItem = [string, { [index: string]: string; Value: string }];

interface RawListProps {
  listItemData: ListItem;
}

export const RawList = ({ listItemData }: RawListProps) => {
  const [metric, { Value, ...AllLabels }] = listItemData;

  const [_, copyToClipboard] = useCopyToClipboard();

  const styles = useStyles(getStyles);

  let attributeValues: string[] = [];

  // @todo clean this up
  for (const key in AllLabels) {
    if (Object.prototype.hasOwnProperty.call(AllLabels, key) && AllLabels[key]) {
      const label = `${key}="${AllLabels[key]}"`;
      attributeValues = [...attributeValues, label];
    }
  }

  const stringRep = `${metric}{${attributeValues.join(',')}}`;

  return (
    <div className={styles.rowWrapper}>
      <span className={styles.rowLabelWrap}>
        <IconButton tooltip="Copy to clipboard" onClick={() => copyToClipboard(stringRep)} name="copy" />
        <span className={styles.rowHeading}>{metric}</span>
        <span>{`{`}</span>
        <span className={styles.rowContent}>
          {attributeValues.map((value, index) => (
            <RawListItem value={value} index={index} length={attributeValues.length} />
          ))}
        </span>
        <span>{`}`}</span>
      </span>
      <span className={styles.rowValue}>{Value}</span>
    </div>
  );
};

/**
 * @todo parsing the string like this seems hacky
 * Aren't we building this same string elsewhere, can't we just pass through more structured data?
 */
/**
 *
 * @param value
 * @param index
 * @param length
 * @constructor
 */
const RawListItem = ({ value, index, length }: { value: string; index: number; length: number }) => {
  const styles = useStyles(getStyles);

  // From the beginning of the string to the start of the `=`
  const attributeName = value.substring(0, value.indexOf('='));

  // From after the `="` to before the last `"`
  const attributeValue = value.substring(value.indexOf('=') + 2, value.length - 1);

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
