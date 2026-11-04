import { merge } from 'lodash';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient, useFlagTableRefreshNewFeatures } from '@grafana/runtime/internal';
import { type TableCellOptions } from '@grafana/schema';
import { Combobox, type ComboboxOption, Field, Stack, Switch, TableCellDisplayMode } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { MarkdownCellOptionsEditor } from './cells/MarkdownCellOptionsEditor';
import { getSparklineCellOptionSearchTerms, SparklineCellOptionsEditor } from './cells/SparklineCellOptionsEditor';

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

function getCellDisplayModeOptions(): Array<ComboboxOption<TableCellOptions['type']>> {
  return [
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
}

export function getTableCellOptionSearchTerms(value?: TableCellOptions): string[] {
  const cellTypeOptions = getCellDisplayModeOptions().flatMap((option) => (option.label ? [option.label] : []));
  let cellEditorOptions: string[] = [];

  switch (value?.type) {
    case TableCellDisplayMode.Gauge:
      cellEditorOptions = [
        t('table.bar-gauge-cell-options-editor.label-gauge-display-mode', 'Gauge display mode'),
        t('table.bar-gauge-cell-options-editor.label-value-display', 'Value display'),
      ];
      break;
    case TableCellDisplayMode.ColorBackground:
      cellEditorOptions = [
        t('table.color-background-cell-options-editor.label-background-display-mode', 'Background display mode'),
        t('table.color-background-cell-options-editor.label-apply-to-entire-row', 'Apply to entire row'),
      ];
      break;
    case TableCellDisplayMode.Sparkline:
      cellEditorOptions = getSparklineCellOptionSearchTerms(value);
      break;
    case TableCellDisplayMode.Image:
      cellEditorOptions = [
        t('table.image-cell-options-editor.label-alt-text', 'Alt text'),
        t('table.image-cell-options-editor.label-title-text', 'Title text'),
      ];
      break;
    case TableCellDisplayMode.Markdown:
      cellEditorOptions = [t('table.markdown-cell-options-editor.label-dynamic-height', 'Dynamic height')];
      break;
    case TableCellDisplayMode.JSONView:
      if (getFeatureFlagClient().getBooleanValue(FlagKeys.TableRefreshNewFeatures, false)) {
        cellEditorOptions = [t('table.json-cell-options.syntax-highlighting', 'Syntax highlighting')];
      }
      break;
  }

  return [...cellTypeOptions, ...cellEditorOptions];
}

export const TableCellOptionEditor = ({ value, onChange, id }: Props) => {
  const jsonSyntaxHighlightingEnabled = useFlagTableRefreshNewFeatures();
  const cellType = value.type;
  const cellDisplayModeOptions = getCellDisplayModeOptions();
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
    <Stack direction="column" gap={2}>
      <Field noMargin>
        <Combobox id={id} options={cellDisplayModeOptions} value={currentMode} onChange={onCellTypeChange} />
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
      {value.type === TableCellDisplayMode.JSONView && jsonSyntaxHighlightingEnabled && (
        <Field noMargin label={t('table.json-cell-options.syntax-highlighting', 'Syntax highlighting')}>
          <Switch
            value={value.syntaxHighlighting !== false}
            onChange={(event) =>
              onCellOptionsChange({
                ...value,
                type: TableCellDisplayMode.JSONView,
                syntaxHighlighting: event.currentTarget.checked,
              })
            }
          />
        </Field>
      )}
    </Stack>
  );
};
