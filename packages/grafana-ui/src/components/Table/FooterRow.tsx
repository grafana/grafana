import React from 'react';
import { ColumnInstance, HeaderGroup } from 'react-table';
import { DataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTableStyles, TableStyles } from './styles';
import { useStyles2 } from '../../themes';
import { EmptyCell, FooterCell } from './FooterCell';

export interface FooterRowProps {
  totalColumnsWidth: number;
  footerGroups: HeaderGroup[];
  footers?: DataFrame;
}

export const FooterRow = (props: FooterRowProps) => {
  const EXTENDED_ROW_HEIGHT = 27;
  const { totalColumnsWidth, footerGroups, footers } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;
  const tableStyles = useStyles2(getTableStyles);

  return (
    <div
      style={{
        position: 'absolute',
        width: totalColumnsWidth ? `${totalColumnsWidth}px` : '100%',
        bottom: '0px',
      }}
    >
      {footerGroups.map((footerGroup: HeaderGroup) => {
        const { key, ...footerGroupProps } = footerGroup.getFooterGroupProps();
        let style = {};
        if (footers && footers.length > 1) {
          const height = EXTENDED_ROW_HEIGHT * footers.length;
          style = { height: `${height}px` };
        }
        {
          return (
            <div
              className={tableStyles.tfoot}
              {...footerGroupProps}
              key={key}
              aria-label={e2eSelectorsTable.footer}
              style={style}
            >
              {footerGroup.headers.map((column: ColumnInstance, index: number) =>
                renderFooterCell(column, tableStyles, style)
              )}
            </div>
          );
        }
      })}
    </div>
  );
};

function renderFooterCell(column: ColumnInstance, tableStyles: TableStyles, style: any) {
  const footerProps = column.getHeaderProps();

  if (!footerProps) {
    return null;
  }

  footerProps.style = footerProps.style ?? {};
  footerProps.style.position = 'absolute';
  footerProps.style.justifyContent = (column as any).justifyContent;
  if (style.height) {
    footerProps.style.height = style.height;
  }

  return (
    <div className={tableStyles.headerCell} {...footerProps}>
      {column.render('Footer')}
    </div>
  );
}

export function getFooterValue(index: number, footers?: DataFrame) {
  if (footers === undefined) {
    return EmptyCell;
  }
  const field = footers.fields[index];
  let values = [];
  for (let i = 0; i < footers.length; i++) {
    const fieldValue = field.values.get(i);
    if (fieldValue !== undefined) {
      values.push(fieldValue);
    }
  }

  return FooterCell({ values });
}
