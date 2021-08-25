import React, { ReactNode } from 'react';
import { ColumnInstance, HeaderGroup } from 'react-table';
import { selectors } from '@grafana/e2e-selectors';
import { getTableStyles, TableStyles } from './styles';
import { useStyles2 } from '../../themes';

export interface FooterRowProps {
  totalColumnsWidth: number;
  footerGroups: HeaderGroup[];
  footer?: ReactNode[];
  height?: number;
}

export const FooterRow = (props: FooterRowProps) => {
  const { totalColumnsWidth, footerGroups, footer, height } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;
  const tableStyles = useStyles2(getTableStyles);

  if (!footer) {
    return null;
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
            aria-label={e2eSelectorsTable.footer}
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

export const EmptyCell = (props: any) => {
  return <span>&nbsp;</span>;
};
