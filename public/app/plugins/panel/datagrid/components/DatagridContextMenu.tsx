import { GridSelection } from '@glideapps/glide-data-grid';
import { capitalize } from 'lodash';
import * as React from 'react';

import { DataFrame, FieldType } from '@grafana/data';
import { convertFieldType } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ContextMenu, MenuGroup, MenuItem } from '@grafana/ui';
import { MenuDivider } from '@grafana/ui/internal';

import { DatagridAction, DatagridActionType } from '../state';
import {
  cleanStringFieldAfterConversion,
  DatagridContextMenuData,
  deleteRows,
  EMPTY_DF,
  INTERACTION_EVENT_NAME,
  INTERACTION_ITEM,
} from '../utils';

interface ContextMenuProps {
  menuData: DatagridContextMenuData;
  data: DataFrame;
  saveData: (data: DataFrame) => void;
  dispatch: React.Dispatch<DatagridAction>;
  closeContextMenu: () => void;
  gridSelection: GridSelection;
  columnFreezeIndex: number;
  renameColumnClicked: () => void;
}

export const DatagridContextMenu = ({
  menuData,
  data,
  saveData,
  closeContextMenu,
  dispatch,
  gridSelection,
  columnFreezeIndex,
  renameColumnClicked,
}: ContextMenuProps) => {
  let selectedRows: number[] = [];
  let selectedColumns: number[] = [];
  const { row, column, x, y, isHeaderMenu } = menuData;

  if (gridSelection.rows) {
    selectedRows = gridSelection.rows.toArray();
  }

  if (gridSelection.columns) {
    selectedColumns = gridSelection.columns.toArray();
  }

  let rowDeletionLabel = 'Delete row';
  if (selectedRows.length && selectedRows.length > 1) {
    rowDeletionLabel = `Delete ${selectedRows.length} rows`;
  }

  let columnDeletionLabel = 'Delete column';
  if (selectedColumns.length && selectedColumns.length > 1) {
    columnDeletionLabel = `Delete ${selectedColumns.length} columns`;
  }

  // Show delete/clear options on cell right click, but not on header right click, unless header column is specifically selected.
  const showDeleteRow = (row !== undefined && row >= 0) || selectedRows.length;
  const showDeleteColumn = (column !== undefined && column >= 0 && row !== undefined) || selectedColumns.length;
  const showClearRow = row !== undefined && row >= 0 && !selectedRows.length;
  const showClearColumn = column !== undefined && column >= 0 && row !== undefined && !selectedColumns.length;

  const renderContextMenuItems = () => (
    <>
      {showDeleteRow ? (
        <MenuItem
          label={rowDeletionLabel}
          onClick={() => {
            if (selectedRows.length) {
              saveData(deleteRows(data, selectedRows, true));
              dispatch({ type: DatagridActionType.gridSelectionCleared });
              return;
            }

            if (row !== undefined && row >= 0) {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                menu_action: 'row_delete',
              });
              saveData(deleteRows(data, [row], true));
            }
          }}
        />
      ) : null}
      {showDeleteColumn ? (
        <MenuItem
          label={columnDeletionLabel}
          onClick={() => {
            if (selectedColumns.length) {
              saveData({
                ...data,
                fields: data.fields.filter((_, index) => !selectedColumns.includes(index)),
              });
              dispatch({ type: DatagridActionType.gridSelectionCleared });
              return;
            }

            if (column !== undefined && column >= 0) {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                menu_action: 'column_delete',
              });
              saveData({
                ...data,
                fields: data.fields.filter((_, index) => index !== column),
              });
            }
          }}
        />
      ) : null}
      {showDeleteColumn || showDeleteRow ? <MenuDivider /> : null}
      {showClearRow ? (
        <MenuItem
          label={t('datagrid.datagrid-context-menu.render-context-menu-items.label-clear-row', 'Clear row')}
          onClick={() => {
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
              menu_action: 'row_clear',
            });
            saveData(deleteRows(data, [row]));
          }}
        />
      ) : null}
      {showClearColumn ? (
        <MenuItem
          label={t('datagrid.datagrid-context-menu.render-context-menu-items.label-clear-column', 'Clear column')}
          onClick={() => {
            const field = data.fields[column];
            field.values = field.values.map(() => null);
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
              menu_action: 'column_clear',
            });
            saveData({
              ...data,
            });
          }}
        />
      ) : null}
      {showClearRow || showClearColumn ? <MenuDivider /> : null}
      <MenuItem
        label={t('datagrid.datagrid-context-menu.render-context-menu-items.label-remove-all-data', 'Remove all data')}
        onClick={() => {
          reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
            menu_action: 'remove_all',
          });
          saveData(EMPTY_DF);
        }}
      />
      <MenuItem
        label={t('datagrid.datagrid-context-menu.render-context-menu-items.label-search', 'Search...')}
        onClick={() => {
          reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
            menu_action: 'open_search',
          });
          dispatch({ type: DatagridActionType.openSearch });
        }}
      />
    </>
  );

  const renderHeaderMenuItems = () => {
    if (column === null || column === undefined) {
      return null;
    }

    const fieldType = data.fields[column].type;
    const fieldTypeConversionData: Array<{
      label: string;
      options: {
        targetField: string;
        destinationType: FieldType;
      };
    }> = [];

    const addToConversionData = (fieldType: FieldType) => {
      fieldTypeConversionData.push({
        label: capitalize(fieldType),
        options: {
          targetField: data.fields[column].name,
          destinationType: fieldType,
        },
      });
    };

    if (fieldType === FieldType.string) {
      addToConversionData(FieldType.number);
      addToConversionData(FieldType.boolean);
    } else if (fieldType === FieldType.number) {
      addToConversionData(FieldType.string);
      addToConversionData(FieldType.boolean);
    } else if (fieldType === FieldType.boolean) {
      addToConversionData(FieldType.number);
      addToConversionData(FieldType.string);
    } else {
      addToConversionData(FieldType.string);
      addToConversionData(FieldType.number);
      addToConversionData(FieldType.boolean);
    }

    let columnFreezeLabel = 'Set column freeze position';
    const columnIndex = column + 1;
    if (columnFreezeIndex === columnIndex) {
      columnFreezeLabel = 'Unset column freeze';
    }

    return (
      <>
        {fieldTypeConversionData.length ? (
          <MenuGroup
            label={t('datagrid.datagrid-context-menu.render-header-menu-items.label-set-field-type', 'Set field type')}
          >
            {fieldTypeConversionData.map((conversionData, index) => (
              <MenuItem
                key={index}
                label={conversionData.label}
                onClick={() => {
                  const field = convertFieldType(data.fields[column], conversionData.options);
                  if (conversionData.options.destinationType === FieldType.string) {
                    cleanStringFieldAfterConversion(field);
                  }

                  const copy = {
                    name: data.name,
                    fields: [...data.fields],
                    length: data.length,
                  };
                  copy.fields[column] = field;

                  reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.HEADER_MENU_ACTION,
                    menu_action: 'convert_field',
                  });
                  saveData(copy);
                }}
              />
            ))}
          </MenuGroup>
        ) : null}
        <MenuDivider />
        <MenuItem
          label={columnFreezeLabel}
          onClick={() => {
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.HEADER_MENU_ACTION,
              menu_action: 'column_freeze',
            });
            if (columnFreezeIndex === columnIndex) {
              dispatch({ type: DatagridActionType.columnFreezeReset });
            } else {
              dispatch({ type: DatagridActionType.columnFreezeChanged, payload: { columnIndex } });
            }
          }}
        />
        <MenuItem
          label={t('datagrid.datagrid-context-menu.render-header-menu-items.label-rename-column', 'Rename column')}
          onClick={renameColumnClicked}
        />
        <MenuDivider />
        <MenuItem
          label={t('datagrid.datagrid-context-menu.render-header-menu-items.label-delete-column', 'Delete column')}
          onClick={() => {
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.HEADER_MENU_ACTION,
              menu_action: 'delete_column',
            });
            saveData({
              ...data,
              fields: data.fields.filter((_, index) => index !== column),
            });

            // also clear selection since it will change it if the deleted column is selected or if indexes shift
            dispatch({ type: DatagridActionType.gridSelectionCleared });
          }}
        />
        <MenuItem
          label={t('datagrid.datagrid-context-menu.render-header-menu-items.label-clear-column', 'Clear column')}
          onClick={() => {
            const field = data.fields[column];
            field.values = field.values.map(() => null);
            reportInteraction(INTERACTION_EVENT_NAME, {
              item: INTERACTION_ITEM.HEADER_MENU_ACTION,
              menu_action: 'clear_column',
            });
            saveData({
              ...data,
            });
          }}
        />
      </>
    );
  };

  return (
    <ContextMenu
      renderMenuItems={isHeaderMenu ? renderHeaderMenuItems : renderContextMenuItems}
      x={x!}
      y={y!}
      onClose={closeContextMenu}
    />
  );
};
