import { css } from '@emotion/css';
import React, { CSSProperties, ReactNode } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../themes';

import { Props as TableProps } from './types';
import { EXPANDER_WIDTH } from './utils';

export interface Props {
  children: (props: TableProps) => ReactNode;
  frames: DataFrame[][];
  rowHeight: number;
  rowIndex: number;
  width: number;
  cellHeight: TableCellHeight;
}

export function ExpandedRow(props: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { children, frames, rowHeight, rowIndex, width, cellHeight } = props;
  const frame = frames[rowIndex];

  let top = rowHeight + theme.spacing.gridSize; // initial height for row that expands above sub tables + 1 grid unit spacing

  return (
    <div className={styles.subTables}>
      {frame.map((data, index) => {
        const noHeader = Boolean(data.meta?.custom?.noHeader);
        const height = rowHeight * (data.length + (noHeader ? 0 : 1)); // account for the header with + 1
        const rowStyle: CSSProperties = {
          height: height,
          paddingLeft: EXPANDER_WIDTH,
          position: 'absolute',
          top,
        };

        return (
          <div style={rowStyle} key={`subTable_${rowIndex}_${index}`}>
            {children({
              data,
              width: width - EXPANDER_WIDTH,
              height: rowHeight * (data.length + 1),
              noHeader,
              cellHeight,
            })}
          </div>
        );
      })}
    </div>
  );
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
