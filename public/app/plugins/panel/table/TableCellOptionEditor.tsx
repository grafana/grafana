import { merge } from 'lodash';
import React, { ReactNode, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { Field, HorizontalGroup, Select, TableCellDisplayMode } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';

const cellDisplayModeOptions = [
  { value: TableCellDisplayMode.Auto, label: 'Auto' },
  { value: TableCellDisplayMode.ColorText, label: 'Colored text' },
  { value: TableCellDisplayMode.ColorBackground, label: 'Colored background' },
  { value: TableCellDisplayMode.Gauge, label: 'Gauge' },
  { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
  { value: TableCellDisplayMode.Image, label: 'Image' },
];

// The props that any cell type editor are expected
// to handle. In this case the generic type should
// be a discriminated interface of TableCellOptions
export interface TableCellEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
}

// Maps display modes to editor components
interface ComponentMap {
  [key: string]: Function;
}

// Maps cell type to options for caching
interface SettingMap {
  [key: string]: TableCellOptions;
}

/*
  Map of display modes to editor components
  Additional cell types can be placed here
  ---
  A cell editor is expected to be a functional
  component that accepts options and displays
  them in a form.
*/
const displayModeComponentMap: ComponentMap = {
  [TableCellDisplayMode.Gauge]: BarGaugeCellOptionsEditor,
  [TableCellDisplayMode.ColorBackground]: ColorBackgroundCellOptionsEditor,
};

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
}

export const TableCellOptionEditor = ({ value, onChange }: Props) => {
  const cellType = value.type;
  let editor: ReactNode | null = null;
  let [settingCache, setSettingCache] = useState<SettingMap>({});

  // Update display mode on change
  const onCellTypeChange = (v: SelectableValue<TableCellDisplayMode>) => {
    if (v.value !== undefined) {
      // Set the new type of cell starting
      // with default settings
      value = {
        type: v.value,
      };

      // When changing cell type see if there were previously stored
      // settings and merge those with the changed value
      if (settingCache[v.value] !== undefined && Object.keys(settingCache[v.value]).length > 1) {
        settingCache[v.value] = merge(value, settingCache[v.value]);
        setSettingCache(settingCache);
        onChange(settingCache[v.value]);
        return;
      }

      onChange(value);
    }
  };

  // When options for a cell change we merge
  // any option changes with our options object
  const onCellOptionsChange = (options: TableCellOptions) => {
    settingCache[value.type] = merge(value, options);
    setSettingCache(settingCache);
    onChange(settingCache[value.type]);
  };

  // Setup specific cell editor
  if (cellType !== undefined && displayModeComponentMap[cellType] !== undefined) {
    let Comp: Function = displayModeComponentMap[cellType];
    editor = <Comp cellOptions={value} onChange={onCellOptionsChange} />;
  }

  // Setup and inject editor
  return (
    <>
      <Field>
        <Select options={cellDisplayModeOptions} value={cellType} onChange={onCellTypeChange} />
      </Field>
      <HorizontalGroup>{editor}</HorizontalGroup>
    </>
  );
};
