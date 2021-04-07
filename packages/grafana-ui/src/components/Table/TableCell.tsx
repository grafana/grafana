import React, { FC, MouseEventHandler } from 'react';
import { Cell } from 'react-table';
import { Field, LinkModel } from '@grafana/data';
import { TableFilterActionCallback } from './types';
import { TableStyles } from './styles';

export interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
  columnIndex: number;
  columnCount: number;
  rowIndex: number;
}

export const TableCell: FC<Props> = ({
  cell,
  field,
  tableStyles,
  onCellFilterAdded,
  columnIndex,
  columnCount,
  rowIndex,
}) => {
  const cellProps = cell.getCellProps();

  if (!field.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.minWidth = cellProps.style.width;
    cellProps.style.justifyContent = (cell.column as any).justifyContent;
  }

  let innerWidth = ((cell.column.width as number) ?? 24) - tableStyles.cellPadding * 2;

  // last child sometimes have extra padding if there is a non overlay scrollbar
  if (columnIndex === columnCount - 1) {
    innerWidth -= tableStyles.lastChildExtraPadding;
  }

  const link: LinkModel | undefined = field.getLinks?.({
    valueRowIndex: rowIndex,
  })[0];

  let onClick: MouseEventHandler<HTMLAnchorElement> | undefined;
  if (link?.onClick) {
    onClick = (event) => {
      // Allow opening in new tab
      if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
        event.preventDefault();
        link!.onClick(event);
      }
    };
  }

  const renderedCell = cell.render('Cell', {
    field,
    tableStyles,
    onCellFilterAdded,
    cellProps,
    innerWidth,
  });
  return link ? (
    <a href={link.href} onClick={onClick} target={link.target} title={link.title} className={tableStyles.cellLink}>
      {renderedCell}
    </a>
  ) : (
    <>{renderedCell}</>
  );
};
