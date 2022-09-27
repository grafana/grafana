import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { VariableSizeList as List } from 'react-window';

import { DataFrame, formattedValueToString } from '@grafana/data/src';
import { stylesFactory } from '@grafana/ui/src';

import RawList from './RawList';

export type instantQueryRawVirtualizedListData = { Value: string; __name__: string; [index: string]: string };

export interface RawListContainerProps {
  tableResult: DataFrame;
}

type instantQueryMetricList = { [index: string]: { [index: string]: instantQueryRawVirtualizedListData } };

const getRawListContainerStyles = stylesFactory(() => {
  return {
    wrapper: css`
      height: 100%;
      overflow: scroll;
    `,
  };
});

/**
 * transform dataFrame to instantQueryRawVirtualizedListData
 * @param dataFrame
 */
const getListItemsFromDataFrameNew = (dataFrame: DataFrame): instantQueryRawVirtualizedListData[] => {
  const metricList: instantQueryMetricList = {};
  const outputList: instantQueryRawVirtualizedListData[] = [];

  // Filter out time
  const newFields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));

  // Get name from each series
  const metricNames: string[] = newFields.find((field) => ['__name__'].includes(field.name))?.values?.toArray() ?? [];

  // Get everything that isn't the name from each series
  const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));

  metricNames.forEach(function (metric: string, i: number) {
    metricList[metric] = {};
    const formattedMetric: instantQueryRawVirtualizedListData = metricList[metric][i] ?? {};

    for (const field of metricLabels) {
      const label = field.name;

      if (label !== 'Time') {
        // Initialize the objects
        if (typeof field?.display === 'function') {
          const stringValue = formattedValueToString(field?.display(field.values.get(i)));
          if (stringValue) {
            formattedMetric[label] = stringValue;
          }
        } else {
          console.warn('Field display method is missing!');
        }
      }
    }

    outputList.push({
      ...formattedMetric,
      __name__: metric,
    });
  });

  return outputList;
};

/**
 * The container that provides the virtualized list to the child components
 * @param props
 * @constructor
 */
const RawListContainer = (props: RawListContainerProps) => {
  const { tableResult } = props;
  let dataFrame = cloneDeep(tableResult);
  const styles = getRawListContainerStyles();

  const items = getListItemsFromDataFrameNew(dataFrame);

  return (
    // We don't use testids around here, how should we target this element in tests?
    <section data-testid={'raw-list-container'}>
      {/* @todo temporarily borrowing this from the prometheus API for debugging, review with UX */}
      <div>Result series: {items.length}</div>

      <List
        itemCount={items.length}
        className={styles.wrapper}
        itemSize={(index: number) => {
          return 42;
        }}
        height={600}
        width="100%"
      >
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
