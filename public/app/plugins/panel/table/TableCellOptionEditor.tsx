import { css } from '@emotion/css';
import { merge } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { Combobox, ComboboxOption, Field, TableCellDisplayMode, useStyles2 } from '@grafana/ui';
import { getTableCellLocalizedDisplayModes } from '@grafana/ui/internal';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { MarkdownCellOptionsEditor } from './cells/MarkdownCellOptionsEditor';
import { SparklineCellOptionsEditor } from './cells/SparklineCellOptionsEditor';

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
  id?: string;
}

const LOCALIZED_CELL_TYPES = getTableCellLocalizedDisplayModes();
const CELL_TYPE_OPTIONS: Array<ComboboxOption<TableCellOptions['type']>> = (
  [
    TableCellDisplayMode.Auto,
    TableCellDisplayMode.ColorText,
    TableCellDisplayMode.ColorBackground,
    TableCellDisplayMode.DataLinks,
    TableCellDisplayMode.Gauge,
    TableCellDisplayMode.Sparkline,
    TableCellDisplayMode.JSONView,
    TableCellDisplayMode.Pill,
    TableCellDisplayMode.Markdown,
    TableCellDisplayMode.Image,
    TableCellDisplayMode.Actions,
  ] as const
).map((value) => ({ label: LOCALIZED_CELL_TYPES[value], value }));

export const TableCellOptionEditor = ({ value, onChange, id }: Props) => {
  const cellType = value.type;
  const styles = useStyles2(getStyles);
  const currentMode = CELL_TYPE_OPTIONS.find((o) => o.value === cellType)!;

  let [settingCache, setSettingCache] = useState<Record<string, TableCellOptions>>({});

  // Update display mode on change
  const onCellTypeChange = (v: ComboboxOption<TableCellOptions['type']>) => {
    if (v !== null) {
      // Set the new type of cell starting
      // with default settings
      value = { type: v.value };

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
        <Combobox id={id} options={CELL_TYPE_OPTIONS} value={currentMode} onChange={onCellTypeChange} />
      </Field>
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
      {cellType === TableCellDisplayMode.Markdown && (
        <MarkdownCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fixBottomMargin: css({
    position: 'relative',
    marginBottom: theme.spacing(-2),
  }),
});
