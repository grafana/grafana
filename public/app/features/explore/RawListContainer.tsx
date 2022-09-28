import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { VariableSizeList as List } from 'react-window';

import { DataFrame } from '@grafana/data/src';
import { stylesFactory } from '@grafana/ui/src';

import RawList from './RawList';
import { getRawPrometheusListItemsFromDataFrame } from './utils/getRawPrometheusListItemsFromDataFrame';

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
  const items = getRawPrometheusListItemsFromDataFrame(dataFrame);

  return (
    // We don't use testids around here, how should we target this element in tests?
    <section data-testid={'raw-list-container'}>
      <div>Result series: {items.length}</div>

      <List itemCount={items.length} className={styles.wrapper} itemSize={() => 42} height={600} width="100%">
        {({ index, style }) => (
          <div role="row" style={{ ...style, overflow: 'hidden' }}>
            <RawList listKey={index} listItemData={items[index]} />
          </div>
        )}
      </List>
    </section>
  );
};

export default RawListContainer;
