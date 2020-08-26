import React, { FC } from 'react';
import { Row, Cell } from 'react-table';
import { Field } from '@grafana/data';

import { getTextAlign } from './utils';
import { TableFilterActionCallback } from './types';
import { TableStyles } from './styles';
import { FilterableTableCell } from './FilterableTableCell';
import { DataLinkModal } from './../DataLinkModal/DataLinkModal';

export interface Props {
  row: Row;
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
}

export const TableCell: FC<Props> = ({ cell, row, field, tableStyles, onCellFilterAdded }) => {
  const filterable = field.config.filterable;
  const cellProps = cell.getCellProps();

  if (cellProps.style) {
    cellProps.style.textAlign = getTextAlign(field);
  }

  if (filterable && onCellFilterAdded) {
    return (
      <FilterableTableCell
        cell={cell}
        field={field}
        tableStyles={tableStyles}
        onCellFilterAdded={onCellFilterAdded}
        cellProps={cellProps}
      />
    );
  }

  let links: any[] = [];
  if (field && field.getLinks) {
    links = field.getLinks({
      valueRowIndex: row.index,
    });
  }
  const link: any = links && links.length > 0 ? links[links.length - 1] : undefined;
  let wrappedCell = <> {renderCell(cell, field, tableStyles)} </>;
  if (link && link.mode === 'modal') {
    wrappedCell = (
      <DataLinkModal modalDisplayMode="html" modalTitle={link.title} modalContent={link.modalTemplate || ''}>
        {renderCell(cell, field, tableStyles)}
      </DataLinkModal>
    );
  }

  return (
    <div {...cellProps} className={tableStyles.tableCellWrapper}>
      {wrappedCell}
    </div>
  );
};

export const renderCell = (cell: Cell, field: Field, tableStyles: TableStyles) =>
  cell.render('Cell', { field, tableStyles });
