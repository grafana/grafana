import { flexRender, type Header, type HeaderGroup } from '@tanstack/react-table';

import { type Field } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, type TFunction } from '@grafana/i18n';

import { getFieldTypeIcon } from '../../../types/icon';
import { Icon } from '../../Icon/Icon';
import { type TableFieldOptions } from '../types';

import { Filter } from './Filter';
import { type TableStyles } from './styles';

export interface HeaderRowProps {
  headerGroups: Array<HeaderGroup<unknown>>;
  showTypeIcons?: boolean;
  tableStyles: TableStyles;
}

export const HeaderRow = (props: HeaderRowProps) => {
  const { headerGroups, showTypeIcons, tableStyles } = props;
  const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;

  return (
    <div role="rowgroup" className={tableStyles.headerRow}>
      {headerGroups.map((headerGroup) => {
        // TanStack Table always builds a header group, even when there are no columns
        if (headerGroup.headers.length === 0) {
          return null;
        }

        return (
          <div
            className={tableStyles.thead}
            key={headerGroup.id}
            aria-label={e2eSelectorsTable.header}
            aria-rowindex={1}
            role="row"
          >
            {headerGroup.headers.map((header) => renderHeaderCell(header, tableStyles, showTypeIcons))}
          </div>
        );
      })}
    </div>
  );
};

function renderHeaderCell(header: Header<unknown, unknown>, tableStyles: TableStyles, showTypeIcons?: boolean) {
  const { column } = header;
  const field: Field | undefined = column.columnDef.meta?.field;
  const tableFieldOptions: TableFieldOptions | undefined = field?.config.custom;
  const isSorted = column.getIsSorted();
  const canResize = column.getCanResize();

  let headerContent = flexRender(column.columnDef.header, header.getContext());

  const ariaLabel =
    typeof headerContent === 'string'
      ? getAriaLabel(headerContent, isSorted === 'desc', Boolean(isSorted), t)
      : t('grafana-ui.table.sort-column', 'Sort column');

  let sortHeaderContent = column.getCanSort() && (
    <>
      <button onClick={column.getToggleSortingHandler()} className={tableStyles.headerCellLabel} aria-label={ariaLabel}>
        {showTypeIcons && (
          <Icon name={getFieldTypeIcon(field)} title={field?.type} size="sm" className={tableStyles.typeIcon} />
        )}
        <div>{headerContent}</div>
        {isSorted &&
          (isSorted === 'desc' ? (
            <Icon size="lg" name="arrow-down" className={tableStyles.sortIcon} />
          ) : (
            <Icon name="arrow-up" size="lg" className={tableStyles.sortIcon} />
          ))}
      </button>
      {column.getCanFilter() && <Filter column={column} tableStyles={tableStyles} field={field} />}
    </>
  );
  if (field && tableFieldOptions?.headerComponent) {
    if (sortHeaderContent) {
      sortHeaderContent = <tableFieldOptions.headerComponent field={field} defaultContent={sortHeaderContent} />;
    } else {
      headerContent = <tableFieldOptions.headerComponent field={field} defaultContent={headerContent} />;
    }
  }

  return (
    <div
      className={tableStyles.headerCell}
      key={header.id}
      role="columnheader"
      style={{
        position: 'absolute',
        justifyContent: column.columnDef.meta?.justifyContent,
        left: column.getStart(),
        width: column.getSize(),
        userSelect: canResize && column.getIsResizing() ? 'none' : 'auto',
      }}
    >
      {column.getCanSort() && sortHeaderContent}
      {!column.getCanSort() && headerContent}
      {!column.getCanSort() && column.getCanFilter() && (
        <Filter column={column} tableStyles={tableStyles} field={field} />
      )}
      {canResize && (
        // resizing is a pointer only affordance, column widths are not keyboard adjustable
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={tableStyles.resizeHandle}
        />
      )}
    </div>
  );
}

const getAriaLabel = (column: string, isDesc: boolean, isSorted: boolean, t: TFunction) => {
  const unsortedLabel = t('grafana-ui.table.sort-by-column', 'Sort by column {{column}}', { column });
  return isSorted
    ? isDesc
      ? t('grafana-ui.table.sort-by-column-descending', 'Sort by column {{column}}, descending', { column })
      : t('grafana-ui.table.sort-by-column-ascending', 'Sort by column {{column}}, ascending', { column })
    : unsortedLabel;
};
