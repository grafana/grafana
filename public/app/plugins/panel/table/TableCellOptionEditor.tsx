import React, { ReactNode, useState } from 'react';

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

interface ComponentMap {
  [key: string]: React.FC<TableCellEditorProps>;
}

const displayModeComponentMap: ComponentMap = {
  [TableCellDisplayMode.Gauge]: BarGaugeCellOptionsEditor,
  [TableCellDisplayMode.ColorBackground]: ColorBackgroundCellOptionsEditor,
};

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
}

export const TableCellOptionEditor: React.FC<Props> = (props) => {
  //const { value } = props;
  const [displayMode, setDisplayMode] = useState(TableCellDisplayMode.Auto);
  let editor: ReactNode | null = null;

  // Update display mode on change
  const onDisplayModeChange = (v: SelectableValue<TableCellDisplayMode>) => {
    if (v.value !== undefined) {
      setDisplayMode(v.value);
    }
  };

  // Setup specific cell editor
  if (displayMode !== undefined && displayModeComponentMap[displayMode] !== undefined) {
    let Comp: React.FC<TableCellEditorProps> = displayModeComponentMap[displayMode];
    editor = <Comp options={props.value} />;
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
