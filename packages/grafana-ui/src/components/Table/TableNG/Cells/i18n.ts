import { t } from '@grafana/i18n';
import { TableCellDisplayMode } from '@grafana/schema';

import { RenderableCellTypes } from '../types';

export const getTableCellLocalizedDisplayModes = (): Record<RenderableCellTypes, string> => ({
  [TableCellDisplayMode.Actions]: t('table.cell-types.actions', 'Actions'),
  [TableCellDisplayMode.Auto]: t('table.cell-types.auto', 'Auto'),
  [TableCellDisplayMode.ColorBackground]: t('table.cell-types.color-background', 'Colored background'),
  [TableCellDisplayMode.ColorText]: t('table.cell-types.color-text', 'Colored text'),
  [TableCellDisplayMode.Custom]: t('table.cell-types.color-text', 'Custom'),
  [TableCellDisplayMode.DataLinks]: t('table.cell-types.data-links', 'Data links'),
  [TableCellDisplayMode.Gauge]: t('table.cell-types.gauge', 'Gauge'),
  [TableCellDisplayMode.Geo]: t('table.cell-types.gauge', 'Geo'),
  [TableCellDisplayMode.Image]: t('table.cell-types.image', 'Image'),
  [TableCellDisplayMode.JSONView]: t('table.cell-types.json', 'JSON View'),
  [TableCellDisplayMode.Markdown]: t('table.cell-types.markdown', 'Markdown + HTML'),
  [TableCellDisplayMode.Pill]: t('table.cell-types.pill', 'Pill'),
  [TableCellDisplayMode.Sparkline]: t('table.cell-types.sparkline', 'Sparkline'),
});

export const getLocalizedDisplayModeName = (mode: RenderableCellTypes): string => {
  return getTableCellLocalizedDisplayModes()[mode] ?? mode;
};
