import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';

import { Field, GrafanaTheme } from '@grafana/data/src';
import { IconButton, useStyles } from '@grafana/ui/src';

import { ItemLabels } from './ItemLabels';
import { instantQueryRawVirtualizedListData } from './RawListContainer';
import RawListItemAttributes from './RawListItemAttributes';

interface RawListProps {
  listItemData: instantQueryRawVirtualizedListData;
  listKey: number;
  totalNumberOfValues: number;
  valueLabels?: Field[];
}

export type RawListValue = { key: string; value: string };

const getStyles = (theme: GrafanaTheme, totalNumberOfValues: number) => ({
  rowWrapper: css`
    border-bottom: 1px solid ${theme.colors.border3};
    display: flex;
    position: relative;
    padding-left: 22px;
  `,
  copyToClipboardWrapper: css`
    position: absolute;
    left: 0;
    top: 0;
  `,
  attributeWrapper: css`
    //display:inline-block
  `,
  rowLabelWrap: css`
    white-space: nowrap;
    overflow-x: scroll;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    width: calc(100% - (${totalNumberOfValues} * 80px) - 25px);

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }
  `,
  rowValue: css`
    min-width: 80px;
    font-weight: bold;
  `,
  rowValuesWrap: css`
    padding-left: 25px;
    font-weight: bold;
    width: calc(${totalNumberOfValues} * 80px);
    display: flex;
  `,
});

function getQueryValues(allLabels: Pick<instantQueryRawVirtualizedListData, 'Value' | string | number>) {
  let attributeValues: RawListValue[] = [];
  let values: RawListValue[] = [];
  for (const key in allLabels) {
    if (key in allLabels && allLabels[key] && !key.includes('Value')) {
      attributeValues.push({
        key: key,
        value: allLabels[key],
      });
    } else if (key in allLabels && allLabels[key] && key.includes('Value')) {
      values.push({
        key: key,
        value: allLabels[key],
      });
    }
  }
  return {
    values: values,
    attributeValues: attributeValues,
  };
}

const ItemValues = ({
  totalNumberOfValues,
  values,
  hideFieldsWithoutValues,
}: {
  totalNumberOfValues: number;
  values: RawListValue[];
  hideFieldsWithoutValues: boolean;
}) => {
  const styles = useStyles((theme) => getStyles(theme, totalNumberOfValues));
  return (
    <div className={styles.rowValuesWrap}>
      {values?.map((value) => {
        if (hideFieldsWithoutValues) {
          if (value.value !== undefined && value.value !== ' ') {
            return (
              <span key={value.key} className={styles.rowValue}>
                {value.value}
              </span>
            );
          } else {
            return null;
          }
        } else {
          return (
            <span key={value.key} className={styles.rowValue}>
              {value.value}
            </span>
          );
        }
      })}
    </div>
  );
};

const RawListItem = ({ listItemData, listKey, totalNumberOfValues, valueLabels }: RawListProps) => {
  const { __name__, ...allLabels } = listItemData;
  const [_, copyToClipboard] = useCopyToClipboard();
  const displayLength = valueLabels?.length ?? totalNumberOfValues;
  const styles = useStyles((theme) => getStyles(theme, displayLength));
  const { values, attributeValues } = getQueryValues(allLabels);

  /**
   * Transform the symbols in the dataFrame to uniform strings
   */
  const transformCopyValue = (value: string): string => {
    if (value === '∞') {
      return '+Inf';
    }
    return value;
  };

  const stringRep = `${__name__}{${attributeValues.map((value) => {
    return `${value.key}="${transformCopyValue(value.value)}"`;
  })}}`;

  const hideFieldsWithoutValues = Boolean(valueLabels && valueLabels?.length);

  return (
    <>
      {valueLabels && valueLabels?.length && <ItemLabels valueLabels={valueLabels} />}
      <div key={listKey} className={styles.rowWrapper}>
        <div className={styles.rowLabelWrap}>
          <span className={styles.copyToClipboardWrapper}>
            <IconButton tooltip="Copy to clipboard" onClick={() => copyToClipboard(stringRep)} name="copy" />
          </span>

          <span>{__name__}</span>
          <span>{`{`}</span>
          <span className={styles.attributeWrapper}>
            {attributeValues.map((value, index) => (
              <RawListItemAttributes value={value} key={index} index={index} length={attributeValues.length} />
            ))}
          </span>
          <span>{`}`}</span>
        </div>

        {/* Output the values */}
        <ItemValues
          hideFieldsWithoutValues={hideFieldsWithoutValues}
          totalNumberOfValues={displayLength}
          values={values}
        />
      </div>
    </>
  );
};
export default RawListItem;
