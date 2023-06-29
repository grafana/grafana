import { css } from '@emotion/css';
import React, { useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { applyFieldOverrides, CoreApp, DataFrame, DataLinkClickEvent, Field, FieldType } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import {
  CustomCellRendererProps,
  IconButton,
  Table,
  TableCellDisplayMode,
  TableCustomCellOptions,
  TableFieldOptions,
  TableSortByFieldState,
  useStyles2,
} from '@grafana/ui';

import { TOP_TABLE_COLUMN_WIDTH } from '../../constants';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { TableData } from '../types';

type Props = {
  data: FlameGraphDataContainer;
  app: CoreApp;
  onSymbolClick: (symbol: string) => void;
  height?: number;
  search?: string;
  sandwichItem?: string;
  onSearch: (str: string) => void;
  onSandwich: (str?: string) => void;
};

const FlameGraphTopTableContainer = ({
  data,
  app,
  onSymbolClick,
  height,
  search,
  onSearch,
  sandwichItem,
  onSandwich,
}: Props) => {
  const styles = useStyles2(getStyles);

  const [sort, setSort] = useState<TableSortByFieldState[]>([{ displayName: 'Self', desc: true }]);

  return (
    <div className={styles.topTableContainer} data-testid="topTable">
      <AutoSizer style={{ width: '100%', height }}>
        {({ width, height }) => {
          if (width < 3 || height < 3) {
            return null;
          }

          const frame = buildTableDataFrame(data, width, onSymbolClick, onSearch, onSandwich, search, sandwichItem);
          return (
            <Table
              initialSortBy={sort}
              onSortByChange={(s) => {
                if (s && s.length) {
                  reportInteraction('grafana_flamegraph_table_sort_selected', {
                    app,
                    grafana_version: config.buildInfo.version,
                    sort: s[0].displayName + '_' + (s[0].desc ? 'desc' : 'asc'),
                  });
                }
                setSort(s);
              }}
              data={frame}
              width={width}
              height={height}
            />
          );
        }}
      </AutoSizer>
    </div>
  );
};

function buildTableDataFrame(
  data: FlameGraphDataContainer,
  width: number,
  onSymbolClick: (str: string) => void,
  onSearch: (str: string) => void,
  onSandwich: (str?: string) => void,
  search?: string,
  sandwichItem?: string
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

  const options: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: (props: CustomCellRendererProps) => {
      const symbol = props.frame.fields.find((f: Field) => f.name === 'Symbol')?.values.get(props.index);
      const isSearched = search === symbol;
      const isSandwiched = sandwichItem === symbol;

      return (
        <div style={{ display: 'flex', height: '24px' }}>
          <IconButton
            style={{ width: '24px', marginRight: 0 }}
            name={'search'}
            variant={isSearched ? 'primary' : 'secondary'}
            tooltip={isSearched ? 'Clear search' : 'Search'}
            onClick={() => {
              onSearch(isSearched ? '' : symbol);
            }}
          />
          <IconButton
            style={{ width: '24px', marginRight: 0 }}
            name={'gf-show-context'}
            tooltip={isSandwiched ? 'Remove sandwich view' : 'Show sandwich view'}
            variant={isSandwiched ? 'primary' : 'secondary'}
            onClick={() => {
              onSandwich(isSandwiched ? undefined : symbol);
            }}
          />
        </div>
      );
    },
  };

  const actionFieldTableConfig: TableFieldOptions = {
    filterable: false,
    width: 61,
    hideHeader: true,
    inspect: false,
    align: 'auto',
    cellOptions: options,
  };

  const actionField: Field = {
    type: FieldType.number,
    name: 'actions',
    values: [],
    config: {
      custom: actionFieldTableConfig,
    },
  };

  const symbolField: Field = {
    type: FieldType.string,
    name: 'Symbol',
    values: [],
    config: {
      custom: { width: width - TOP_TABLE_COLUMN_WIDTH * 2 },
      links: [
        {
          title: 'Highlight symbol',
          url: '',
          onClick: (e: DataLinkClickEvent) => {
            const field: Field = e.origin.field;
            const value = field.values[e.origin.rowIndex];
            onSymbolClick(value);
          },
        },
      ],
    },
  };

  const selfField: Field = {
    type: FieldType.number,
    name: 'Self',
    values: [],
    config: { unit: data.selfField.config.unit, custom: { width: TOP_TABLE_COLUMN_WIDTH } },
  };

  const totalField: Field = {
    type: FieldType.number,
    name: 'Total',
    values: [],
    config: { unit: data.valueField.config.unit, custom: { width: TOP_TABLE_COLUMN_WIDTH } },
  };

  for (let key in table) {
    actionField.values.push(null);
    symbolField.values.push(key);
    selfField.values.push(table[key].self);
    totalField.values.push(table[key].total);
  }

  const frame = { fields: [actionField, symbolField, selfField, totalField], length: symbolField.values.length };

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

const getStyles = () => {
  return {
    topTableContainer: css`
      flex-grow: 1;
      flex-basis: 50%;
      overflow: hidden;
    `,
  };
};

export default FlameGraphTopTableContainer;
