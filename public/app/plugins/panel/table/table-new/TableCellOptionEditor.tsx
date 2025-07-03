import { css } from '@emotion/css';
import { merge } from 'lodash';
import { useState, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellOptions } from '@grafana/schema';
import { Field, Select, TableCellDisplayMode, useStyles2 } from '@grafana/ui';

import { AutoCellOptionsEditor } from './cells/AutoCellOptionsEditor';
import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
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
}

export const TableCellOptionEditor = ({ value, onChange }: Props) => {
  const cellDisplayModes: Record<TableCellOptions['type'], SelectableValue<TableCellOptions>> = useMemo(
    () => ({
      [TableCellDisplayMode.Auto]: {
        value: { type: TableCellDisplayMode.Auto },
        label: t('grafana-ui.table.cell-type.auto', 'Auto'),
      },
      [TableCellDisplayMode.Sparkline]: {
        value: { type: TableCellDisplayMode.Sparkline },
        label: t('grafana-ui.table.cell-type.sparkline', 'Sparkline'),
      },
      [TableCellDisplayMode.ColorText]: {
        value: { type: TableCellDisplayMode.ColorText },
        label: t('grafana-ui.table.cell-type.color-text', 'Colored text'),
      },
      [TableCellDisplayMode.ColorBackground]: {
        value: { type: TableCellDisplayMode.ColorBackground },
        label: t('grafana-ui.table.cell-type.color-background', 'Colored background'),
      },
      [TableCellDisplayMode.Gauge]: {
        value: { type: TableCellDisplayMode.Gauge },
        label: t('grafana-ui.table.cell-type.gauge', 'Gauge'),
      },
      [TableCellDisplayMode.DataLinks]: {
        value: { type: TableCellDisplayMode.DataLinks },
        label: t('grafana-ui.table.cell-type.data-links', 'Data links'),
      },
      [TableCellDisplayMode.JSONView]: {
        value: { type: TableCellDisplayMode.JSONView },
        label: t('grafana-ui.table.cell-type.json', 'JSON View'),
      },
      [TableCellDisplayMode.Image]: {
        value: { type: TableCellDisplayMode.Image },
        label: t('grafana-ui.table.cell-type.image', 'Image'),
      },
      [TableCellDisplayMode.Actions]: {
        value: { type: TableCellDisplayMode.Actions },
        label: t('grafana-ui.table.cell-type.actions', 'Actions'),
      },
      [TableCellDisplayMode.Markdown]: {
        value: { type: TableCellDisplayMode.Markdown },
        label: t('grafana-ui.table.cell-type.markdown', 'Markdown'),
      },
    }),
    []
  );

  const cellDisplayModeOptions: Array<SelectableValue<TableCellOptions>> = useMemo(
    () => Object.values(cellDisplayModes),
    [cellDisplayModes]
  );

  const cellType = value.type;
  const styles = useStyles2(getStyles);
  const currentMode = cellDisplayModes[cellType];
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
      {(cellType === TableCellDisplayMode.Auto || cellType === TableCellDisplayMode.ColorText) && (
        <AutoCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  fixBottomMargin: css({
    marginBottom: theme.spacing(-2),
  }),
});
