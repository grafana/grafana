import { merge } from 'lodash';
import React, { ReactNode } from 'react';

import { SelectableValue } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { Field, HorizontalGroup, Select, TableCellDisplayMode } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { TableCellEditorProps } from './models.gen';

const cellDisplayModeOptions = [
  { value: TableCellDisplayMode.Auto, label: 'Auto' },
  { value: TableCellDisplayMode.ColorText, label: 'Colored text' },
  { value: TableCellDisplayMode.ColorBackground, label: 'Colored background' },
  { value: TableCellDisplayMode.Gauge, label: 'Gauge' },
  { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
  { value: TableCellDisplayMode.Image, label: 'Image' },
];

// Maps display modes to editor components
interface ComponentMap {
  [key: string]: React.FC<TableCellEditorProps>;
}

/*
  Map of display modes to editor components
  Additional cell types can be placed here
  ---
  A cell editor is expected to be a functional
  component (per the above type) that accepts a
  sub-options object and an onSubOptions change 
  callback
*/
const displayModeComponentMap: ComponentMap = {
  [TableCellDisplayMode.Gauge]: BarGaugeCellOptionsEditor,
  [TableCellDisplayMode.ColorBackground]: ColorBackgroundCellOptionsEditor,
};

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
}

export const TableCellOptionEditor: React.FC<Props> = ({ value, onChange }) => {
  const displayMode = value.displayMode;
  let editor: ReactNode | null = null;

  // Update display mode on change
  const onDisplayModeChange = (v: SelectableValue<TableCellDisplayMode>) => {
    if (v.value !== undefined) {
      value.displayMode = v.value;
      onChange(value);
    }
  };

  // When options for a cell change we update the corresponding
  // key in the subOptions object merging changes with any
  // previous updates that have been made
  const onSubOptionsChange = (options: object) => {
    const displayModeOptions = value.subOptions[value.displayMode];
    value.subOptions[value.displayMode] = merge({}, displayModeOptions, options);
  };

  // console.log(value);

  // Setup specific cell editor
  if (displayMode !== undefined && displayModeComponentMap[displayMode] !== undefined) {
    let Comp: React.FC<TableCellEditorProps> = displayModeComponentMap[displayMode];
    editor = <Comp subOptions={value.subOptions} onSubOptionsChange={onSubOptionsChange} />;
  }

  // Setup and inject editor
  return (
    <>
      <Field label="Cell display mode" description="Color text, background, show as gauge, etc.">
        <Select options={cellDisplayModeOptions} value={displayMode} onChange={onDisplayModeChange} />
      </Field>
      <HorizontalGroup>{editor}</HorizontalGroup>
    </>
  );
};
