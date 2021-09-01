import React from 'react';
import { ColumnInstance, HeaderGroup } from 'react-table';
import { selectors } from '@grafana/e2e-selectors';
import { getTableStyles, TableStyles } from './styles';
import { useStyles2 } from '../../themes';
import { FooterItem } from './types';
import { EmptyCell, FooterCell } from './FooterCell';

export interface FooterRowProps {
  totalColumnsWidth: number;
  footerGroups: HeaderGroup[];
  footerValues?: FooterItem[];
}

export const FooterRow = (props: FooterRowProps) => {
  const { totalColumnsWidth, footerGroups, footerValues } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;
  const tableStyles = useStyles2(getTableStyles);
  const EXTENDED_ROW_HEIGHT = 27;

  if (!footerValues) {
    return null;
  }

  let length = 0;
  for (const fv of footerValues) {
    if (Array.isArray(fv) && fv.length > length) {
      length = fv.length;
    }
  }

  let height: number | undefined;
  if (footerValues && length > 1) {
    height = EXTENDED_ROW_HEIGHT * length;
  }

  return (
    <table
      style={{
        position: 'absolute',
        width: totalColumnsWidth ? `${totalColumnsWidth}px` : '100%',
        bottom: '0px',
      }}
    >
      {footerGroups.map((footerGroup: HeaderGroup) => {
        const { key, ...footerGroupProps } = footerGroup.getFooterGroupProps();
        return (
          <tfoot
            className={tableStyles.tfoot}
            {...footerGroupProps}
            key={key}
            data-testid={e2eSelectorsTable.footer}
            style={height ? { height: `${height}px` } : undefined}
          >
            <tr>
              {footerGroup.headers.map((column: ColumnInstance, index: number) =>
                renderFooterCell(column, tableStyles, height)
              )}
            </tr>
          </tfoot>
        );
      })}
    </table>
  );
};

function renderFooterCell(column: ColumnInstance, tableStyles: TableStyles, height?: number) {
  const footerProps = column.getHeaderProps();

  if (!footerProps) {
    return null;
  }

  footerProps.style = footerProps.style ?? {};
  footerProps.style.position = 'absolute';
  footerProps.style.justifyContent = (column as any).justifyContent;
  if (height) {
    footerProps.style.height = height;
  }

  return (
    <th className={tableStyles.headerCell} {...footerProps}>
      {column.render('Footer')}
    </th>
  );
}

export function getFooterValue(index: number, footerValues?: FooterItem[]) {
  if (footerValues === undefined) {
    return EmptyCell;
  }

  return FooterCell({ value: footerValues[index] });
}
