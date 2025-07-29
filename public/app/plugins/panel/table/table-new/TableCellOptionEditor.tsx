import { css } from '@emotion/css';
import { merge } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { TableCellOptions, TableWrapTextOptions } from '@grafana/schema';
import { Field, Select, TableCellDisplayMode, useStyles2 } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { SparklineCellOptionsEditor } from './cells/SparklineCellOptionsEditor';
import { TextWrapOptionsEditor } from './cells/TextWrapOptionsEditor';

// The props that any cell type editor are expected
// to handle. In this case the generic type should
// be a discriminated interface of TableCellOptions
export interface TableCellEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
}

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
}

const TEXT_WRAP_CELL_TYPES = new Set([
  TableCellDisplayMode.Auto,
  TableCellDisplayMode.Sparkline,
  TableCellDisplayMode.ColorText,
  TableCellDisplayMode.ColorBackground,
  TableCellDisplayMode.DataLinks,
]);

function isTextWrapCellType(value: TableCellOptions): value is TableCellOptions & TableWrapTextOptions {
  return TEXT_WRAP_CELL_TYPES.has(value.type);
}

export const TableCellOptionEditor = ({ value, onChange }: Props) => {
  const cellType = value.type;
  const styles = useStyles2(getStyles);
  const currentMode = cellDisplayModeOptions.find((o) => o.value!.type === cellType)!;
  let [settingCache, setSettingCache] = useState<Record<string, TableCellOptions>>({});

  // Update display mode on change
  const onCellTypeChange = (v: SelectableValue<TableCellOptions>) => {
    if (v.value !== undefined) {
      // Set the new type of cell starting
      // with default settings
      value = v.value;

      // When changing cell type see if there were previously stored
      // settings and merge those with the changed value
      if (settingCache[value.type] !== undefined && Object.keys(settingCache[value.type]).length > 1) {
        value = merge({}, value, settingCache[value.type]);
      }

      onChange(value);
    }
  };

  // When options for a cell change we merge
  // any option changes with our options object
  const onCellOptionsChange = (options: TableCellOptions) => {
    settingCache[value.type] = merge({}, value, options);
    setSettingCache(settingCache);
    onChange(settingCache[value.type]);
  };

  // Setup and inject editor
  return (
    <div className={styles.fixBottomMargin}>
      <Field>
        <Select options={cellDisplayModeOptions} value={currentMode} onChange={onCellTypeChange} />
      </Field>
      {isTextWrapCellType(value) && <TextWrapOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />}
      {cellType === TableCellDisplayMode.Gauge && (
        <BarGaugeCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.ColorBackground && (
        <ColorBackgroundCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.Sparkline && (
        <SparklineCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.Image && (
        <ImageCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
    </div>
  );
};

let cellDisplayModeOptions: Array<SelectableValue<TableCellOptions>> = [
  { value: { type: TableCellDisplayMode.Auto }, label: 'Auto' },
  { value: { type: TableCellDisplayMode.Sparkline }, label: 'Sparkline' },
  { value: { type: TableCellDisplayMode.ColorText }, label: 'Colored text' },
  { value: { type: TableCellDisplayMode.ColorBackground }, label: 'Colored background' },
  { value: { type: TableCellDisplayMode.Gauge }, label: 'Gauge' },
  { value: { type: TableCellDisplayMode.DataLinks }, label: 'Data links' },
  { value: { type: TableCellDisplayMode.JSONView }, label: 'JSON View' },
  { value: { type: TableCellDisplayMode.Image }, label: 'Image' },
  { value: { type: TableCellDisplayMode.Actions }, label: 'Actions' },
  { value: { type: TableCellDisplayMode.Pill }, label: 'Pill' },
];

const getStyles = (theme: GrafanaTheme2) => ({
  fixBottomMargin: css({
    marginBottom: theme.spacing(-2),
  }),
});
