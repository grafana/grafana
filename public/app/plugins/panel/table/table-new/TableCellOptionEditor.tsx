import { css } from '@emotion/css';
import { merge } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellOptions, TableWrapTextOptions } from '@grafana/schema';
import { Combobox, ComboboxOption, Field, TableCellDisplayMode, useStyles2 } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { MarkdownCellOptionsEditor } from './cells/MarkdownCellOptionsEditor';
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
  TableCellDisplayMode.Pill,
]);

function isTextWrapCellType(value: TableCellOptions): value is TableCellOptions & TableWrapTextOptions {
  return TEXT_WRAP_CELL_TYPES.has(value.type);
}

export const TableCellOptionEditor = ({ value, onChange }: Props) => {
  const cellType = value.type;
  const styles = useStyles2(getStyles);
  const cellDisplayModeOptions: Array<ComboboxOption<TableCellOptions['type']>> = [
    { value: TableCellDisplayMode.Auto, label: t('table.cell-types.auto', 'Auto') },
    { value: TableCellDisplayMode.ColorText, label: t('table.cell-types.color-text', 'Colored text') },
    {
      value: TableCellDisplayMode.ColorBackground,
      label: t('table.cell-types.color-background', 'Colored background'),
    },
    { value: TableCellDisplayMode.DataLinks, label: t('table.cell-types.data-links', 'Data links') },
    { value: TableCellDisplayMode.Gauge, label: t('table.cell-types.gauge', 'Gauge') },
    { value: TableCellDisplayMode.Sparkline, label: t('table.cell-types.sparkline', 'Sparkline') },
    { value: TableCellDisplayMode.JSONView, label: t('table.cell-types.json', 'JSON View') },
    { value: TableCellDisplayMode.Pill, label: t('table.cell-types.pill', 'Pill') },
    { value: TableCellDisplayMode.Markdown, label: t('table.cell-types.markdown', 'Markdown + HTML') },
    { value: TableCellDisplayMode.Image, label: t('table.cell-types.image', 'Image') },
    { value: TableCellDisplayMode.Actions, label: t('table.cell-types.actions', 'Actions') },
  ];
  const currentMode = cellDisplayModeOptions.find((o) => o.value === cellType)!;

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
        <Combobox options={cellDisplayModeOptions} value={currentMode} onChange={onCellTypeChange} />
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
