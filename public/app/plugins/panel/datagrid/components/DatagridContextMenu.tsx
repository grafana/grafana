import React from 'react';

import { ArrayVector, DataFrame } from '@grafana/data';
import { ContextMenu, MenuItem } from '@grafana/ui';
import { MenuDivider } from '@grafana/ui/src/components/Menu/MenuDivider';

import { EMPTY_DF } from '../utils';

interface Props {
  x: number;
  y: number;
  column: number;
  row: number;
  data: DataFrame;
  saveData: (data: DataFrame) => void;
  closeContextMenu: () => void;
  setToggleSearch: (toggleSearch: boolean) => void;
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
}: Props) => {
  const renderItems = () => (
    <>
      <MenuItem
        label="Delete row"
        onClick={() => {
          saveData({
            ...data,
            fields: data.fields.map((field) => {
              const valuesArray = field.values.toArray();
              valuesArray.splice(row, 1);
              field.values = new ArrayVector(valuesArray);

              return field;
            }),
            length: data.length - 1,
          });
        }}
      />
      <MenuItem
        label="Delete column"
        onClick={() => {
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
          saveData({
            ...data,
            fields: data.fields.map((field) => {
              const valuesArray = field.values.toArray();
              valuesArray.splice(row, 1, null);
              field.values = new ArrayVector(valuesArray);

              return field;
            }),
          });
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
