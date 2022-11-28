import React, { ReactNode } from 'react';

//import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { Field, Select, TableCellDisplayMode } from '@grafana/ui';

import { BarGaugeCellOptions } from './cells/BarGaugeCellOptions';

const cellDisplayModeOptions = [
  { value: TableCellDisplayMode.Auto, label: 'Auto' },
  { value: TableCellDisplayMode.ColorText, label: 'Colored text' },
  { value: TableCellDisplayMode.ColorBackground, label: 'Colored background' },
  { value: TableCellDisplayMode.Gauge, label: 'Gauge' },
  { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
  { value: TableCellDisplayMode.Image, label: 'Image' },
];

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
}

export const TableCellOptionEditor: React.FC<Props> = (props) => {
  const { value } = props;

  // Do processing with the values here
  let editor: ReactNode | null = null;

  if (true) {
    editor = <BarGaugeCellOptions {...props} />;
  }

  const onDisplayModeChange = (v) => {};

  // Setup and inject editor
  return (
    <>
      <Field label="Cell display mode" description="Color text, background, show as gauge, etc.">
        <Select options={cellDisplayModeOptions} value={value.displayMode} onChange={onDisplayModeChange} />
      </Field>

      {editor}
    </>
  );
};

export const cellHasSubOptions = (displayMode: string): boolean => {
  return displayMode === 'gauge';
};
