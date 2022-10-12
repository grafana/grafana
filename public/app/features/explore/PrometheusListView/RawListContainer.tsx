import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, {useEffect, useState} from 'react';
import { VariableSizeList as List } from 'react-window';

import { DataFrame, Field } from '@grafana/data/src';
import { stylesFactory } from '@grafana/ui/src';

import { getRawPrometheusListItemsFromDataFrame } from '../utils/getRawPrometheusListItemsFromDataFrame';

import RawList from './RawList';

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
    valueNavigation: css`
      padding-right: 20px;

      &:last-child {
        padding-right: 0;
      }
    `,
    valueNavigationActive: css`
      padding-right: 15px;
      text-decoration: underline;
    `,
    valueNavigationWrapper: css`
      display: flex;
      justify-content: flex-end;
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

  const valueLabels = dataFrame.fields.filter((field) => field.name.includes('Value #'));
  const initialValueName = valueLabels.length > 0 ? valueLabels[0].name : 'Value';
  const [selectedValue, setSelectedValue] = useState<string>(initialValueName);

  const items = getRawPrometheusListItemsFromDataFrame(dataFrame, selectedValue);

  useEffect(() => {
    // If the current value is for a single query, but we are passing in multiple, select the first value
    if(selectedValue === 'Value' && valueLabels.length > 0){
      setSelectedValue(valueLabels[0].name);
      return;
    }
    // If the current value is for multiple queries, but we are only passing in one, set the value for a single query
    if(selectedValue !== 'Value' && valueLabels.length === 0){
      setSelectedValue('Value');
      return;
    }
    // If they removed the selected set of values, select the first value
    if(valueLabels.length > 0 && !valueLabels.find(label => label.name === selectedValue)){
      setSelectedValue(valueLabels[0].name);
    }

  }, [valueLabels.length])

  const OnValueClick = (field: Field) => {
    setSelectedValue(field.name);
  };

  return (
    // We don't use testids around here, how should we target this element in tests?
    <section data-testid={'raw-list-container'}>
      <div>Result series: {items.length}</div>
      {valueLabels.length > 1 && (
        <div className={styles.valueNavigationWrapper}>
          {valueLabels.map((value, index) => (
            <a
              style={value.name === selectedValue ? { textDecoration: 'underline' } : {}}
              className={styles.valueNavigation}
              key={index}
              onClick={() => OnValueClick(value)}
            >
              {value.name}
            </a>
          ))}
        </div>
      )}

      <List itemCount={items.length} className={styles.wrapper} itemSize={() => 42} height={600} width="100%">
        {({ index, style }) => (
          <div role="row" style={{ ...style, overflow: 'hidden' }}>
            <RawList selectedValueName={selectedValue} listKey={index} listItemData={items[index]} />
          </div>
        )}
      </List>
    </section>
  );
};

export default RawListContainer;
