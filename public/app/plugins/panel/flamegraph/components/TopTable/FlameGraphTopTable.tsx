import React from 'react';

import { applyFieldOverrides, ArrayVector, DataFrame, Field, FieldType } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { Table } from '@grafana/ui';

import { TOP_TABLE_COLUMN_WIDTH } from '../../constants';
import { TopTableData } from '../types';

type Props = {
  width: number;
  height: number;
  data: TopTableData[];
  search: string;
  setSearch: (search: string) => void;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

function FlameGraphTopTable({
  width,
  height,
  data,
  search,
  setSearch,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMax,
  setRangeMin,
}: Props) {
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

  const frame = buildTableDataFrame(data, width, onSymbolClick);
  const initialSortBy = [{ displayName: 'Self', desc: true }];

  return <Table initialSortBy={initialSortBy} data={frame} width={width} height={height} />;
}

function buildTableDataFrame(data: TopTableData[], width: number, onSymbolClick: (str: string) => void): DataFrame {
  const frame: DataFrame = {
    fields: [
      {
        type: FieldType.string,
        name: 'Symbol',
        values: new ArrayVector(data.map((d) => d.symbol)),
        config: {
          custom: { width: width - TOP_TABLE_COLUMN_WIDTH * 2 },
          links: [
            {
              title: 'Highlight symbol',
              url: '',
              onClick: (e) => {
                const field: Field = e.origin.field;
                const value = field.values.get(e.origin.rowIndex);
                onSymbolClick(value);
              },
            },
          ],
        },
      },
      {
        type: FieldType.number,
        name: 'Self',
        values: new ArrayVector(data.map((d) => d.self.value)),
        config: { unit: 'short', custom: { width: TOP_TABLE_COLUMN_WIDTH } },
      },
      {
        type: FieldType.number,
        name: 'Total',
        values: new ArrayVector(data.map((d) => d.total.value)),
        config: { unit: 'bytes', custom: { width: TOP_TABLE_COLUMN_WIDTH } },
      },
    ],
    length: data.length,
  };

  const dataFrames = applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value: string, scopedVars) => getTemplateSrv().replace(value, scopedVars),
    theme: config.theme2,
  });

  return dataFrames[0];
}

export default FlameGraphTopTable;
