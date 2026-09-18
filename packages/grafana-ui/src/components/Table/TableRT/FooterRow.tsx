import { flexRender, type Header, type HeaderGroup } from '@tanstack/react-table';
import { type CSSProperties } from 'react';

import { fieldReducers, ReducerID } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { EmptyCell, FooterCell } from '../Cells/FooterCell';
import { type FooterItem } from '../types';

import { type TableStyles } from './styles';

export interface FooterRowProps {
  totalColumnsWidth: number;
  footerGroups: HeaderGroup[];
  footerValues: FooterItem[];
  isPaginationVisible: boolean;
  tableStyles: TableStyles;
}

export function FooterRow(props: FooterRowProps) {
  const { totalColumnsWidth, footerGroups, isPaginationVisible, tableStyles } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;

  return (
    <div
      style={{
        position: isPaginationVisible ? 'relative' : 'absolute',
        width: totalColumnsWidth ? `${totalColumnsWidth}px` : '100%',
        bottom: '0px',
      }}
    >
      {footerGroups.map((footerGroup: HeaderGroup) => {
        return (
          <div className={tableStyles.tfoot} key={footerGroup.id} data-testid={e2eSelectorsTable.footer}>
            {footerGroup.headers.map((header) => renderFooterCell(header, tableStyles))}
          </div>
        );
      })}
    </div>
  );
}

function renderFooterCell(header: Header<unknown, unknown>, tableStyles: TableStyles) {
  const { column } = header;
  return (
    <div
      key={header.id}
      className={tableStyles.headerCell}
      style={{
        position: 'absolute',
        left: column.getStart(),
        width: column.getSize(),
        justifyContent: (column.columnDef as { justifyContent?: CSSProperties['justifyContent'] }).justifyContent,
      }}
    >
      {flexRender(column.columnDef.footer, header.getContext())}
    </div>
  );
}

export function getFooterValue(index: number, footerValues?: FooterItem[], isCountRowsSet?: boolean) {
  if (footerValues === undefined) {
    return EmptyCell;
  }

  if (isCountRowsSet) {
    if (footerValues[index] === undefined) {
      return EmptyCell;
    }

    const key = fieldReducers.get(ReducerID.count).name;

    return FooterCell({ value: [{ [key]: String(footerValues[index]) }] });
  }

  return FooterCell({ value: footerValues[index] });
}
