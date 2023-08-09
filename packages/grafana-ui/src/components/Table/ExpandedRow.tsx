import React, { CSSProperties } from 'react';

import { DataFrame, Field } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { Table } from './Table';
import { TableStyles } from './styles';
import { EXPANDER_WIDTH } from './utils';

export interface Props {
  nestedData: Field;
  tableStyles: TableStyles;
  rowIndex: number;
  width: number;
  cellHeight: TableCellHeight;
}

export function ExpandedRow({ tableStyles, nestedData, rowIndex, width, cellHeight }: Props) {
  const frames = nestedData.values as DataFrame[][];
  const subTables: React.ReactNode[] = [];

  let top = tableStyles.rowHeight; // initial height for row that expands above sub tables

  frames[rowIndex].forEach((nf: DataFrame, nfIndex: number) => {
    const noHeader = !!nf.meta?.custom?.noHeader;
    const height = tableStyles.rowHeight * (nf.length + (noHeader ? 0 : 1)); // account for the header with + 1

    const subTableStyle: CSSProperties = {
      height: height,
      paddingLeft: EXPANDER_WIDTH,
      position: 'absolute',
      top,
    };

    top += height;

    subTables.push(
      <div style={subTableStyle} key={`subTable_${rowIndex}_${nfIndex}`}>
        <Table
          data={nf}
          width={width - EXPANDER_WIDTH}
          height={tableStyles.rowHeight * (nf.length + 1)}
          noHeader={noHeader}
          cellHeight={cellHeight}
        />
      </div>
    );
  });

  return <>{subTables}</>;
}

export function getExpandedRowHeight(nestedData: Field, rowIndex: number, tableStyles: TableStyles) {
  const frames = nestedData.values as DataFrame[][];

  const height = frames[rowIndex].reduce((acc: number, frame: DataFrame) => {
    if (frame.length) {
      const noHeader = !!frame.meta?.custom?.noHeader;
      return acc + tableStyles.rowHeight * (frame.length + (noHeader ? 0 : 1)); // account for the header with + 1
    }
    return acc;
  }, tableStyles.rowHeight); // initial height for row that expands above sub tables

  return height ?? tableStyles.rowHeight;
}
