import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { VariableSizeList as List } from 'react-window';

import { DataFrame, formattedValueToString } from '@grafana/data/src';
import { stylesFactory } from '@grafana/ui/src';

import RawList from './RawList';
import { instantQueryRawVirtualizedListData } from './TableContainer';

interface RawListContainerProps {
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

const RawListContainer = (props: RawListContainerProps) => {
  const { tableResult } = props;
  let dataFrame = cloneDeep(tableResult);
  const styles = getRawListContainerStyles();

  // const olditems = this.getListItemsFromDataFrame(dataFrame);
  const items = getListItemsFromDataFrameNew(dataFrame);

  return (
    <>
      {/* @todo temporarily borrowing this from the prometheus API for debugging, review with UX */}
      <div>Result series: {items.length}</div>

      {/* @todo these are arbitrary numbers */}
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
          <div style={{ ...style, overflow: 'hidden' }}>
            <RawList listKey={index} listItemData={items[index]} />
          </div>
        )}
      </List>
    </>
  );
};

export default RawListContainer;
