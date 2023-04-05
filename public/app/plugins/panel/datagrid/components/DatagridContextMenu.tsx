import { GridSelection } from '@glideapps/glide-data-grid';
import React from 'react';

import { ArrayVector, DataFrame } from '@grafana/data';
import { ContextMenu, MenuItem } from '@grafana/ui';
import { MenuDivider } from '@grafana/ui/src/components/Menu/MenuDivider';

import { deleteRows, EMPTY_DF } from '../utils';

interface Props {
  x: number;
  y: number;
  column: number;
  row: number;
  data: DataFrame;
  saveData: (data: DataFrame) => void;
  closeContextMenu: () => void;
  setToggleSearch: (toggleSearch: boolean) => void;
  gridSelection: GridSelection;
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
  if (selectedRows.length) {
    rowDeletionLabel = `Delete ${selectedRows.length} rows`;
  }

  let columnDeletionLabel = 'Delete column';
  if (selectedColumns.length) {
    columnDeletionLabel = `Delete ${selectedColumns.length} columns`;
  }

  const renderItems = () => (
    <>
      <MenuItem
        label={rowDeletionLabel}
        onClick={() => {
          if (selectedRows.length) {
            saveData(deleteRows(data, selectedRows, true));
            return;
          }

          saveData(deleteRows(data, [row], true));
        }}
      />
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
      <MenuDivider />
      {/* TODO: decide if we keep this or not. Delete Keypress covers this and selection delete scenario so I feel this is not needed 
      <MenuItem
        label="Clear cell"
        onClick={() => {
          const field = data.fields[column];
          const valuesArray = field.values.toArray();
          valuesArray.splice(row, 1, null);
          field.values = new ArrayVector(valuesArray);

          saveData({
            ...data,
          });
        }}
        shortcut="Delete"
      /> */}
      <MenuItem
        label="Clear row"
        onClick={() => {
          saveData(deleteRows(data, [row]));
        }}
      />
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

  return <ContextMenu renderMenuItems={renderItems} x={x} y={y} onClose={closeContextMenu} />;
};
