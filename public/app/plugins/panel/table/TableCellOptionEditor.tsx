import React, { useState, ReactNode } from 'react';

import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
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

// interface TableCellSubOptionEditorProps {
//   editor: ReactNode; // Each cell type will provide it's own editor
// }

export const TableCellOptionEditor: React.FC<FieldOverrideEditorProps<string, object>> = (props: object) => {
  // Do processing with the values here
  let editor: ReactNode | null = null;
  const [value, setValue] = useState<SelectableValue<string>>();

  if (true) {
    editor = <BarGaugeCellOptions {...props} />;
  }

  console.log(props);

  // Setup and inject editor
  return (
    <>
      <Field label="Cell display mode" description="Color text, background, show as gauge, etc.">
        <Select
          options={cellDisplayModeOptions}
          value={value}
          onChange={(v) => {
            setValue(v);
          }}
        />
      </Field>

      {editor}
    </>
  );
};

export const cellHasSubOptions = (displayMode: string): boolean => {
  return displayMode === 'gauge';
};
