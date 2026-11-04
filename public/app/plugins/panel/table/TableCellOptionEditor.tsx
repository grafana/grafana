import { merge } from 'lodash';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient, useFlagTableRefreshNewFeatures } from '@grafana/runtime/internal';
import { type TableCellOptions } from '@grafana/schema';
import { Combobox, type ComboboxOption, Field, Stack, Switch, TableCellDisplayMode } from '@grafana/ui';

import { barGaugeCellOptionLabels, BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import {
  colorBackgroundCellOptionLabels,
  ColorBackgroundCellOptionsEditor,
} from './cells/ColorBackgroundCellOptionsEditor';
import { imageCellOptionLabels, ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { markdownCellOptionLabel, MarkdownCellOptionsEditor } from './cells/MarkdownCellOptionsEditor';
import { getSparklineCellOptionSearchTerms, SparklineCellOptionsEditor } from './cells/SparklineCellOptionsEditor';
import { CellOptionSearchLabel } from './cells/CellOptionSearchLabel';

const jsonCellOptionLabels = {
  syntaxHighlighting: t('table.json-cell-options.syntax-highlighting', 'Syntax highlighting'),
};

// The props that any cell type editor are expected
// to handle. In this case the generic type should
// be a discriminated interface of TableCellOptions
export interface TableCellEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
  searchQuery?: string;
}

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
  id?: string;
  searchQuery?: string;
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
      cellEditorOptions = Object.values(barGaugeCellOptionLabels);
      break;
    case TableCellDisplayMode.ColorBackground:
      cellEditorOptions = Object.values(colorBackgroundCellOptionLabels);
      break;
    case TableCellDisplayMode.Sparkline:
      cellEditorOptions = getSparklineCellOptionSearchTerms(value);
      break;
    case TableCellDisplayMode.Image:
      cellEditorOptions = Object.values(imageCellOptionLabels);
      break;
    case TableCellDisplayMode.Markdown:
      cellEditorOptions = [markdownCellOptionLabel];
      break;
    case TableCellDisplayMode.JSONView:
      if (getFeatureFlagClient().getBooleanValue(FlagKeys.TableRefreshNewFeatures, false)) {
        cellEditorOptions = Object.values(jsonCellOptionLabels);
      }
      break;
  }

  return [...cellTypeOptions, ...cellEditorOptions];
}

export const TableCellOptionEditor = ({ value, onChange, id, searchQuery }: Props) => {
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
        <BarGaugeCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} searchQuery={searchQuery} />
      )}
      {cellType === TableCellDisplayMode.ColorBackground && (
        <ColorBackgroundCellOptionsEditor
          cellOptions={value}
          onChange={onCellOptionsChange}
          searchQuery={searchQuery}
        />
      )}
      {cellType === TableCellDisplayMode.Sparkline && (
        <SparklineCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} searchQuery={searchQuery} />
      )}
      {cellType === TableCellDisplayMode.Image && (
        <ImageCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} searchQuery={searchQuery} />
      )}
      {cellType === TableCellDisplayMode.Markdown && (
        <MarkdownCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} searchQuery={searchQuery} />
      )}
      {value.type === TableCellDisplayMode.JSONView && jsonSyntaxHighlightingEnabled && (
        <Field
          noMargin
          label={<CellOptionSearchLabel label={jsonCellOptionLabels.syntaxHighlighting} searchQuery={searchQuery} />}
        >
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
