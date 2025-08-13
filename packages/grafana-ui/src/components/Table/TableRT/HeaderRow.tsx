import { HeaderGroup, Column } from 'react-table';

import { Field } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { getFieldTypeIcon } from '../../../types/icon';
import { Icon } from '../../Icon/Icon';
import { TableFieldOptions } from '../types';

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
  const { key, ...headerProps } = column.getHeaderProps();
  const field: Field = column.field ?? null;
  const tableFieldOptions: TableFieldOptions | undefined = field?.config.custom;

  if (column.canResize) {
    headerProps.style.userSelect = column.isResizing ? 'none' : 'auto'; // disables selecting text while resizing
  }

  headerProps.style.position = 'absolute';
  headerProps.style.justifyContent = column.justifyContent;
  headerProps.style.left = column.totalLeft;

  let headerContent = column.render('Header');

  let sortHeaderContent = column.canSort && (
    <>
      <button {...column.getSortByToggleProps()} className={tableStyles.headerCellLabel}>
        {showTypeIcons && (
          <Icon name={getFieldTypeIcon(field)} title={field?.type} size="sm" className={tableStyles.typeIcon} />
        )}
        <div>{headerContent}</div>
        {column.isSorted &&
          (column.isSortedDesc ? (
            <Icon size="lg" name="arrow-down" className={tableStyles.sortIcon} />
          ) : (
            <Icon name="arrow-up" size="lg" className={tableStyles.sortIcon} />
          ))}
      </button>
      {column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
    </>
  );
  if (sortHeaderContent && tableFieldOptions?.headerComponent) {
    sortHeaderContent = <tableFieldOptions.headerComponent field={field} defaultContent={sortHeaderContent} />;
  } else if (tableFieldOptions?.headerComponent) {
    headerContent = <tableFieldOptions.headerComponent field={field} defaultContent={headerContent} />;
  }

  return (
    <div className={tableStyles.headerCell} key={key} {...headerProps} role="columnheader">
      {column.canSort && sortHeaderContent}
      {!column.canSort && headerContent}
      {!column.canSort && column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
