import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';

import { Field, GrafanaTheme } from '@grafana/data/src';
import { IconButton, useStyles } from '@grafana/ui/src';

import { ItemLabels } from './ItemLabels';
import { ItemValues } from './ItemValues';
import { instantQueryRawVirtualizedListData } from './RawListContainer';
import RawListItemAttributes from './RawListItemAttributes';

export interface RawListProps {
  listItemData: instantQueryRawVirtualizedListData;
  listKey: number;
  totalNumberOfValues: number;
  valueLabels?: Field[];
  isExpandedView: boolean;
}

export type RawListValue = { key: string; value: string };

export const rawListExtraSpaceAtEndOfLine = '20px';
export const rawListItemColumnWidth = '80px';
export const rawListpaddingToHoldSpaceForCopyIcon = '25px';
const getStyles = (theme: GrafanaTheme, totalNumberOfValues: number, isExpandedView: boolean) => ({
  rowWrapper: css`
    border-bottom: 1px solid ${theme.colors.border3};
    display: flex;
    position: relative;
    padding-left: 22px;
    ${!isExpandedView ? 'height: calc(100% - 5px);' : ''}
  `,
  copyToClipboardWrapper: css`
    position: absolute;
    left: 0;
    top: 3px;
    z-index: 1;
  `,
  rowLabelWrapWrap: css`
    position: relative;
    width: calc(100% - (${totalNumberOfValues} * ${rawListItemColumnWidth}) - ${rawListpaddingToHoldSpaceForCopyIcon});
  `,
  rowLabelWrap: css`
    white-space: nowrap;
    overflow-x: auto;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    padding-right: ${rawListExtraSpaceAtEndOfLine};

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }
    &:after {
      pointer-events: none;
      content: '';
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      background: linear-gradient(
        to right,
        transparent calc(100% - ${rawListExtraSpaceAtEndOfLine}),
        ${theme.colors.bg1}
      );
    }
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

const RawListItem = ({ listItemData, listKey, totalNumberOfValues, valueLabels, isExpandedView }: RawListProps) => {
  const { __name__, ...allLabels } = listItemData;
  const [_, copyToClipboard] = useCopyToClipboard();
  const displayLength = valueLabels?.length ?? totalNumberOfValues;
  const styles = useStyles((theme) => getStyles(theme, displayLength, isExpandedView));
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
    return value.key !== 'le' ? `${value.key}="${transformCopyValue(value.value)}"` : '';
  })}}`;

  const hideFieldsWithoutValues = Boolean(valueLabels && valueLabels?.length);

  return (
    <>
      {valueLabels !== undefined && isExpandedView && (
        <ItemLabels valueLabels={valueLabels} expanded={isExpandedView} />
      )}
      <div key={listKey} className={styles.rowWrapper}>
        <span className={styles.copyToClipboardWrapper}>
          <IconButton tooltip="Copy to clipboard" onClick={() => copyToClipboard(stringRep)} name="copy" />
        </span>
        <span className={styles.rowLabelWrapWrap}>
          <div className={styles.rowLabelWrap}>
            <span>{__name__}</span>
            <span>{`{`}</span>
            <span>
              {attributeValues.map((value, index) => (
                <RawListItemAttributes
                  isExpandedView={isExpandedView}
                  value={value}
                  key={index}
                  index={index}
                  length={attributeValues.length}
                />
              ))}
            </span>
            <span>{`}`}</span>
          </div>
        </span>

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
