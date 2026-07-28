import { createDataFrame, FieldType, getPanelDataSummary, PanelPlugin } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { plugin } from './module';

function customConfigItem(path: string) {
  const item = plugin.fieldConfigRegistry.list().find((i) => i.path === path);
  if (!item) {
    throw new Error(`no custom field config option registered at path "${path}"`);
  }
  return item;
}

describe('table module', () => {
  it('exports a PanelPlugin rendering TablePanel', () => {
    expect(plugin).toBeInstanceOf(PanelPlugin);
    expect(plugin.panel).toBe(TablePanel);
  });

  it('wires up the migration and panel-change handlers', () => {
    expect(plugin.onPanelMigration).toBe(tableMigrationHandler);
    expect(plugin.onPanelTypeChanged).toBe(tablePanelChangedHandler);
  });

  it('wires up the suggestions supplier', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      }),
    ]);
    expect(plugin.getSuggestions(dataSummary)).toHaveLength(1);
  });

  it('registers the cell-options custom editors', () => {
    const paths = plugin.fieldConfigRegistry.list().map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'footer.reducers',
        'cellOptions',
        'inspect',
        'tooltip.field',
        'tooltip.placement',
        'styleField',
      ])
    );
  });

  describe('"Cell value inspect" visibility', () => {
    const showIf = (type: TableCellDisplayMode) =>
      // showIf receives the custom field config; only cellOptions.type gates this switch
      customConfigItem('inspect').showIf!({ cellOptions: { type } } as never, undefined);

    it.each([
      TableCellDisplayMode.Auto,
      TableCellDisplayMode.JSONView,
      TableCellDisplayMode.ColorText,
      TableCellDisplayMode.ColorBackground,
    ])('is shown for the %s cell type', (type) => {
      expect(showIf(type)).toBe(true);
    });

    it.each([TableCellDisplayMode.Gauge, TableCellDisplayMode.Image, TableCellDisplayMode.Sparkline])(
      'is hidden for the %s cell type',
      (type) => {
        expect(showIf(type)).toBe(false);
      }
    );
  });

  describe('"Tooltip placement" visibility', () => {
    const showIf = (field?: string) =>
      customConfigItem('tooltip.placement').showIf!(
        { tooltip: field === undefined ? {} : { field } } as never,
        undefined
      );

    it('is hidden until a tooltip field is chosen', () => {
      expect(showIf(undefined)).toBe(false);
    });

    it('is shown once a tooltip field is chosen', () => {
      expect(showIf('metric')).toBe(true);
    });
  });
});
