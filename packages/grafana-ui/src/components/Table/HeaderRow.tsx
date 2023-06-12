import React from 'react';
import { HeaderGroup, Column } from 'react-table';

import { selectors } from '@grafana/e2e-selectors';

import { getFieldTypeIcon } from '../../types';
import { Icon } from '../Icon/Icon';

import { Filter } from './Filter';
import { TableStyles } from './styles';

export interface HeaderRowProps {
  headerGroups: HeaderGroup[];
  showTypeIcons?: boolean;
  tableStyles: TableStyles;
}

export const HeaderRow = (props: HeaderRowProps) => {
  const { headerGroups, showTypeIcons, tableStyles } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;

  return (
    <div role="rowgroup" className={tableStyles.headerRow}>
      {headerGroups.map((headerGroup: HeaderGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
        return (
          <div
            className={tableStyles.thead}
            {...headerGroupProps}
            key={key}
            aria-label={e2eSelectorsTable.header}
            role="row"
          >
            {headerGroup.headers.map((column: Column, index: number) =>
              renderHeaderCell(column, tableStyles, showTypeIcons)
            )}
          </div>
        );
      })}
    </div>
  );
};

function renderHeaderCell(column: any, tableStyles: TableStyles, showTypeIcons?: boolean) {
  const headerProps = column.getHeaderProps();
  const field = column.field ?? null;

  if (column.canResize) {
    headerProps.style.userSelect = column.isResizing ? 'none' : 'auto'; // disables selecting text while resizing
  }

  headerProps.style.position = 'absolute';
  headerProps.style.justifyContent = column.justifyContent;

  return (
    <div className={tableStyles.headerCell} {...headerProps} role="columnheader">
      {column.canSort && (
        <>
          <button {...column.getSortByToggleProps()} className={tableStyles.headerCellLabel}>
            {showTypeIcons && (
              <Icon name={getFieldTypeIcon(field)} title={field?.type} size="sm" className={tableStyles.typeIcon} />
            )}
            <div>{column.render('Header')}</div>
            {column.isSorted &&
              (column.isSortedDesc ? (
                <Icon size="lg" name="arrow-down" className={tableStyles.sortIcon} />
              ) : (
                <Icon name="arrow-up" size="lg" className={tableStyles.sortIcon} />
              ))}
          </button>
          {column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
        </>
      )}
      {!column.canSort && column.render('Header')}
      {!column.canSort && column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
