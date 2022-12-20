import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { useWindowSize } from 'react-use';
import { VariableSizeList as List } from 'react-window';

import { DataFrame } from '@grafana/data/src';
import { Button, stylesFactory } from '@grafana/ui/src';

import { getRawPrometheusListItemsFromDataFrame } from '../utils/getRawPrometheusListItemsFromDataFrame';

import { ItemLabels } from './ItemLabels';
import RawListItem from './RawListItem';

export type instantQueryRawVirtualizedListData = { Value: string; __name__: string; [index: string]: string };

export interface RawListContainerProps {
  tableResult: DataFrame;
}

const getRawListContainerStyles = stylesFactory(() => {
  return {
    wrapper: css`
      height: 100%;
      overflow: scroll;
    `,
    mobileWrapper: css`
      height: 100%;
      overflow: scroll;
      .list-item-attribute {
        display: block;
        text-indent: 1em;
      }
    `,
    header: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
    `,
  };
});

/**
 * The container that provides the virtualized list to the child components
 * @param props
 * @constructor
 */
const RawListContainer = (props: RawListContainerProps) => {
  const { tableResult } = props;
  let dataFrame = cloneDeep(tableResult);
  const styles = getRawListContainerStyles();

  const valueLabels = dataFrame.fields.filter((field) => field.name.includes('Value'));
  const items = getRawPrometheusListItemsFromDataFrame(dataFrame);
  const { width } = useWindowSize();
  const [isExpandedView, setIsExpandedView] = useState(width <= 480 || valueLabels.length > 2);

  const onContentClick = () => {
    setIsExpandedView(!isExpandedView);
  };

  const getListItemHeight = (itemIndex: number) => {
    const singleLineHeight = 42;
    const additionalLineHeight = 22;
    if (!isExpandedView) {
      return singleLineHeight;
    }
    const item = items[itemIndex];

    // Height of a single line, plus the number of non value attributes times the height of additional lines plus padding
    return singleLineHeight + (Object.keys(item).length - valueLabels.length) * additionalLineHeight + 5;
  };

  return (
    <section data-testid={'raw-list-container'}>
      <header className={styles.header}>
        <Button
          variant="secondary"
          title="Add query"
          icon={isExpandedView ? 'minus' : 'plus'}
          type="button"
          onClick={onContentClick}
        >
          {isExpandedView ? 'Contract' : 'Expand'}
        </Button>
        <div>Result series: {items.length}</div>
      </header>

      <div role={'table'}>
        {/* Using one component and changing properties wasn't working well with the virtualized list */}
        {/* MOBILE VIEW OR COMPARING MANY VALUES */}
        {isExpandedView && (
          <List
            itemCount={items.length}
            className={styles.mobileWrapper}
            itemSize={getListItemHeight}
            height={600}
            width="100%"
          >
            {({ index, style }) => {
              const filteredValueLabels = valueLabels.filter((valueLabel) => {
                const itemWithValue = items[index][valueLabel.name];
                return itemWithValue && itemWithValue !== ' ';
              });
              return (
                <div role="row" style={{ ...style, overflow: 'hidden' }}>
                  <RawListItem
                    valueLabels={filteredValueLabels}
                    totalNumberOfValues={filteredValueLabels.length}
                    listKey={index}
                    listItemData={items[index]}
                  />
                </div>
              );
            }}
          </List>
        )}

        {/* DESKTOP VIEW AND COMPARING FEW VALUES */}
        {!isExpandedView && (
          <>
            {valueLabels.length > 1 && <ItemLabels valueLabels={valueLabels} />}
            <List
              itemCount={items.length}
              className={styles.wrapper}
              itemSize={getListItemHeight}
              height={600}
              width="100%"
            >
              {({ index, style }) => {
                return (
                  <div role="row" style={{ ...style, overflow: 'hidden' }}>
                    <RawListItem totalNumberOfValues={valueLabels.length} listKey={index} listItemData={items[index]} />
                  </div>
                );
              }}
            </List>
          </>
        )}
      </div>
    </section>
  );
};

export default RawListContainer;
