import { css } from '@emotion/css';
import { CSSProperties } from 'react';
import * as React from 'react';

import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { EXPANDER_WIDTH } from '../utils';

import { Table } from './Table';
import { TableStyles } from './styles';

export interface Props {
  nestedData: Field;
  tableStyles: TableStyles;
  rowIndex: number;
  width: number;
  cellHeight: TableCellHeight;
}

export function ExpandedRow({ tableStyles, nestedData, rowIndex, width, cellHeight }: Props) {
  const frames: DataFrame[][] = nestedData.values;
  const subTables: React.ReactNode[] = [];
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  let top = tableStyles.rowHeight + theme.spacing.gridSize; // initial height for row that expands above sub tables + 1 grid unit spacing

  frames[rowIndex].forEach((nf: DataFrame, nfIndex: number) => {
    const noHeader = !!nf.meta?.custom?.noHeader;
    const height = tableStyles.rowHeight * (nf.length + (noHeader ? 0 : 1)); // account for the header with + 1

    const subTable: CSSProperties = {
      height: height,
      paddingLeft: EXPANDER_WIDTH,
      position: 'absolute',
      top,
      backgroundColor: theme.colors.background.primary,
      color: theme.colors.text.primary,
    };

    top += height + theme.spacing.gridSize;

    subTables.push(
      <div style={subTable} key={`subTable_${rowIndex}_${nfIndex}`}>
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

  return <div className={styles.subTables}>{subTables}</div>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    subTables: css({
      '&:before': {
        content: '""',
        position: 'absolute',
        width: '1px',
        top: theme.spacing(5),
        left: theme.spacing(1),
        bottom: theme.spacing(2),
        background: theme.colors.border.medium,
      },
    }),
  };
};

export function getExpandedRowHeight(nestedData: Field, rowIndex: number, tableStyles: TableStyles) {
  const frames: DataFrame[][] = nestedData.values;

  const height = frames[rowIndex].reduce((acc: number, frame: DataFrame) => {
    if (frame.length) {
      const noHeader = !!frame.meta?.custom?.noHeader;
      return acc + tableStyles.rowHeight * (frame.length + (noHeader ? 0 : 1)) + 8; // account for the header with + 1
    }
    return acc;
  }, tableStyles.rowHeight); // initial height for row that expands above sub tables

  return height ?? tableStyles.rowHeight;
}
