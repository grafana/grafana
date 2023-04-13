import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  ArrayVector,
  CoreApp,
  DataFrame,
  DataLinkClickEvent,
  Field,
  FieldType,
} from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { Table, useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL, TOP_TABLE_COLUMN_WIDTH } from '../../constants';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { SelectedView, TableData } from '../types';

type Props = {
  data: FlameGraphDataContainer;
  app: CoreApp;
  totalLevels: number;
  selectedView: SelectedView;
  search: string;
  setSearch: (search: string) => void;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

const FlameGraphTopTableContainer = ({
  data,
  app,
  totalLevels,
  selectedView,
  search,
  setSearch,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMin,
  setRangeMax,
}: Props) => {
  const styles = useStyles2(() => getStyles(selectedView, app));

  const onSymbolClick = (symbol: string) => {
    if (search === symbol) {
      setSearch('');
    } else {
      setSearch(symbol);
      // Reset selected level in flamegraph when selecting row in top table
      setTopLevelIndex(0);
      setSelectedBarIndex(0);
      setRangeMin(0);
      setRangeMax(1);
    }
  };

  const initialSortBy = [{ displayName: 'Self', desc: true }];

  return (
    <div className={styles.topTableContainer} data-testid="topTable">
      <AutoSizer style={{ width: '100%', height: PIXELS_PER_LEVEL * totalLevels + 'px' }}>
        {({ width, height }) => {
          if (width < 3 || height < 3) {
            return null;
          }

          const frame = buildTableDataFrame(data, width, onSymbolClick);
          return <Table initialSortBy={initialSortBy} data={frame} width={width} height={height} />;
        }}
      </AutoSizer>
    </div>
  );
};

function buildTableDataFrame(
  data: FlameGraphDataContainer,
  width: number,
  onSymbolClick: (str: string) => void
): DataFrame {
  // Group the data by label
  // TODO: should be by filename + funcName + linenumber?
  let table: { [key: string]: TableData } = {};
  for (let i = 0; i < data.data.length; i++) {
    const value = data.getValue(i);
    const self = data.getSelf(i);
    const label = data.getLabel(i);
    table[label] = table[label] || {};
    table[label].self = table[label].self ? table[label].self + self : self;
    table[label].total = table[label].total ? table[label].total + value : value;
  }

  const symbolField = {
    type: FieldType.string,
    name: 'Symbol',
    values: new ArrayVector(),
    config: {
      custom: { width: width - TOP_TABLE_COLUMN_WIDTH * 2 },
      links: [
        {
          title: 'Highlight symbol',
          url: '',
          onClick: (e: DataLinkClickEvent) => {
            const field: Field = e.origin.field;
            const value = field.values.get(e.origin.rowIndex);
            onSymbolClick(value);
          },
        },
      ],
    },
  };

  const selfField = {
    type: FieldType.number,
    name: 'Self',
    values: new ArrayVector(),
    config: { unit: data.selfField.config.unit, custom: { width: TOP_TABLE_COLUMN_WIDTH } },
  };

  const totalField = {
    type: FieldType.number,
    name: 'Total',
    values: new ArrayVector(),
    config: { unit: data.valueField.config.unit, custom: { width: TOP_TABLE_COLUMN_WIDTH } },
  };

  for (let key in table) {
    symbolField.values.add(key);
    selfField.values.add(table[key].self);
    totalField.values.add(table[key].total);
  }

  const frame = { fields: [symbolField, selfField, totalField], length: symbolField.values.length };

  const dataFrames = applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value: string) => value,
    theme: config.theme2,
  });

  return dataFrames[0];
}

const getStyles = (selectedView: SelectedView, app: CoreApp) => {
  const marginRight = '20px';

  return {
    topTableContainer: css`
      cursor: pointer;
      float: left;
      margin-right: ${marginRight};
      width: ${selectedView === SelectedView.TopTable ? '100%' : `calc(50% - ${marginRight})`};
      ${app !== CoreApp.Explore
        ? 'height: calc(100% - 50px)'
        : 'height: calc(100% + 50px)'}; // 50px to adjust for header pushing content down
    `,
  };
};

export default FlameGraphTopTableContainer;
