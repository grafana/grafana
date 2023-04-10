import { GridSelection } from '@glideapps/glide-data-grid';
import React from 'react';

import { ArrayVector, DataFrame, FieldType } from '@grafana/data';
import { convertFieldType } from '@grafana/data/src/transformations/transformers/convertFieldType';
import { ContextMenu, MenuItem } from '@grafana/ui';
import { MenuDivider } from '@grafana/ui/src/components/Menu/MenuDivider';

import { deleteRows, EMPTY_DF, EMPTY_GRID_SELECTION } from '../utils';

interface Props {
  x: number;
  y: number;
  column?: number;
  row?: number;
  data: DataFrame;
  saveData: (data: DataFrame) => void;
  closeContextMenu: () => void;
  setToggleSearch: (toggleSearch: boolean) => void;
  gridSelection: GridSelection;
  setGridSelection: (gridSelection: GridSelection) => void;
  isHeaderMenu?: boolean;
  setColumnFreezeIndex: (index: number) => void;
  columnFreezeIndex: number;
}

export const DatagridContextMenu = ({
  x,
  y,
  column,
  row,
  data,
  saveData,
  closeContextMenu,
  setToggleSearch,
  gridSelection,
  setGridSelection,
  isHeaderMenu,
  setColumnFreezeIndex,
  columnFreezeIndex,
}: Props) => {
  let selectedRows: number[] = [];
  let selectedColumns: number[] = [];

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

  const renderContextMenuItems = () => (
    <>
      {(row !== undefined && row >= 0) || selectedRows.length ? (
        <MenuItem
          label={rowDeletionLabel}
          onClick={() => {
            if (selectedRows.length) {
              saveData(deleteRows(data, selectedRows, true));
              setGridSelection(EMPTY_GRID_SELECTION);
              return;
            }

            if (row !== undefined && row >= 0) {
              saveData(deleteRows(data, [row], true));
            }
          }}
        />
      ) : null}
      {(column !== undefined && column >= 0) || selectedColumns.length ? (
        <MenuItem
          label={columnDeletionLabel}
          onClick={() => {
            if (selectedColumns.length) {
              saveData({
                ...data,
                fields: data.fields.filter((_, index) => !selectedColumns.includes(index)),
              });
              return;
            }

            if (column !== undefined && column >= 0) {
              saveData({
                ...data,
                fields: data.fields.filter((_, index) => index !== column),
              });
            }
          }}
        />
      ) : null}
      <MenuDivider />
      {row !== undefined && row >= 0 && !selectedRows.length ? (
        <MenuItem
          label="Clear row"
          onClick={() => {
            saveData(deleteRows(data, [row]));
          }}
        />
      ) : null}
      {column !== undefined && column >= 0 && !selectedColumns.length ? (
        <MenuItem
          label="Clear column"
          onClick={() => {
            const field = data.fields[column];
            field.values = new ArrayVector(field.values.toArray().map(() => null));

            saveData({
              ...data,
            });
          }}
        />
      ) : null}
      <MenuDivider />
      <MenuItem
        label="Remove all data"
        onClick={() => {
          saveData(EMPTY_DF);
        }}
      />
      <MenuItem label="Search..." onClick={() => setToggleSearch(true)} />
    </>
  );

  const renderHeaderMenuItems = () => {
    if (!column) {
      return null;
    }

    const fieldType = data.fields[column].type;
    let labelTpl = 'Change to %s field type';
    const fieldTypeConversionData: Array<{
      label: string;
      options: {
        targetField: string;
        destinationType: FieldType;
      };
    }> = [];

    const addToConversionData = (fieldType: FieldType) => {
      fieldTypeConversionData.push({
        label: labelTpl.replace('%s', fieldType),
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
    }

    let columnFreezeLabel = 'Set column freeze position';
    const columnIdx = column + 1;
    if (columnFreezeIndex === columnIdx) {
      columnFreezeLabel = 'Unset column freeze';
    }

    return (
      <>
        {fieldTypeConversionData.map((conversionData, index) => (
          <MenuItem
            key={index}
            label={conversionData.label}
            onClick={() => {
              const field = convertFieldType(data.fields[column], conversionData.options);
              const copy = {
                name: data.name,
                fields: [...data.fields],
                length: data.length,
              };
              copy.fields[column] = field;

              saveData(copy);
            }}
          />
        ))}
        <MenuItem
          label={columnFreezeLabel}
          onClick={() => {
            if (columnFreezeIndex === columnIdx) {
              setColumnFreezeIndex(0);
            } else {
              setColumnFreezeIndex(columnIdx);
            }
          }}
        />
        <MenuDivider />
        <MenuItem
          label={columnDeletionLabel}
          onClick={() => {
            if (selectedColumns.length) {
              saveData({
                ...data,
                fields: data.fields.filter((_, index) => !selectedColumns.includes(index)),
              });
              return;
            }

            saveData({
              ...data,
              fields: data.fields.filter((_, index) => index !== column),
            });
          }}
        />
      </>
    );
  };

  return (
    <ContextMenu
      renderMenuItems={isHeaderMenu ? renderHeaderMenuItems : renderContextMenuItems}
      x={x}
      y={y}
      onClose={closeContextMenu}
    />
  );
};
