import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  PanelOptionsEditorBuilder,
  PanelPlugin,
  standardEditorsRegistry,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { plugin } from './module';
import { type Options } from './panelcfg.gen';
import { tableSuggestionsSupplier } from './suggestions';

let mockRowsAsFieldsFlag = false;

jest.mock('@grafana/runtime/internal', () => {
  const actual = jest.requireActual('@grafana/runtime/internal');
  return {
    ...actual,
    getFeatureFlagClient: () => ({
      getBooleanValue: (key: string) => (key === actual.FlagKeys.TableRowsAsFields ? mockRowsAsFieldsFlag : false),
    }),
  };
});

// building the plugin's fieldConfigRegistry runs the table useCustomConfig path,
// which resolves the 'stats-picker' standard editor; initialise the registry so
// this file does not depend on another test having done so first
standardEditorsRegistry.setInit(getAllOptionEditors);

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

  it('wires up the table suggestions supplier', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      }),
    ]);

    // Assert the plugin delegates to tableSuggestionsSupplier by matching the wired supplier's
    // scores; the supplier's own count/score semantics are covered in suggestions.test.ts.
    const supplied = tableSuggestionsSupplier(dataSummary);
    const pluginSuggestions = plugin.getSuggestions(dataSummary);
    if (!supplied || !pluginSuggestions) {
      throw new Error('expected the table plugin and supplier to return suggestions');
    }
    expect(pluginSuggestions.map((s) => s.score)).toEqual(supplied.map((s) => s.score));
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

    it.each`
      cellType                                | shown
      ${TableCellDisplayMode.Auto}            | ${true}
      ${TableCellDisplayMode.JSONView}        | ${true}
      ${TableCellDisplayMode.ColorText}       | ${true}
      ${TableCellDisplayMode.ColorBackground} | ${true}
      ${TableCellDisplayMode.Gauge}           | ${false}
      ${TableCellDisplayMode.Image}           | ${false}
      ${TableCellDisplayMode.Sparkline}       | ${false}
    `(
      'is $shown for the $cellType cell type',
      ({ cellType, shown }: { cellType: TableCellDisplayMode; shown: boolean }) => {
        expect(showIf(cellType)).toBe(shown);
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

  describe('rows-as-fields option gating', () => {
    const buildPanelItems = () => {
      const builder = new PanelOptionsEditorBuilder<Options>();
      plugin.getPanelOptionsSupplier()(builder, { data: [] });
      return builder.getItems();
    };

    const plainFrame = createDataFrame({ fields: [{ name: 'a', type: FieldType.string, values: ['x'] }] });
    const nestedFrame = createDataFrame({
      fields: [
        { name: 'a', type: FieldType.string, values: ['x'] },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: [[createDataFrame({ fields: [{ name: 'b', type: FieldType.number, values: [1] }] })]],
        },
      ],
    });

    afterEach(() => {
      mockRowsAsFieldsFlag = false;
    });

    it('gates the "Rows as fields" switch behind the feature toggle', () => {
      const rowsAsFields = buildPanelItems().find((item) => item.path === 'rowsAsFields');
      expect(rowsAsFields).toBeDefined();

      mockRowsAsFieldsFlag = false;
      expect(rowsAsFields?.showIf?.({} as Options, [plainFrame])).toBe(false);

      mockRowsAsFieldsFlag = true;
      expect(rowsAsFields?.showIf?.({} as Options, [plainFrame])).toBe(true);
    });

    it('hides the "Rows as fields" switch when nested frames are present', () => {
      mockRowsAsFieldsFlag = true;
      const rowsAsFields = buildPanelItems().find((item) => item.path === 'rowsAsFields');

      expect(rowsAsFields?.showIf?.({} as Options, [plainFrame])).toBe(true);
      expect(rowsAsFields?.showIf?.({} as Options, [nestedFrame])).toBe(false);
    });

    it('hides frozen-columns and show-header only when rows-as-fields is active', () => {
      mockRowsAsFieldsFlag = true;
      const items = buildPanelItems();
      const gated = [items.find((i) => i.path === 'frozenColumns.left'), items.find((i) => i.path === 'showHeader')];

      for (const item of gated) {
        // shown when the option is off
        expect(item?.showIf?.({ rowsAsFields: false } as Options, [plainFrame])).toBe(true);
        // hidden when rows-as-fields is on and the data is flat
        expect(item?.showIf?.({ rowsAsFields: true } as Options, [plainFrame])).toBe(false);
        // shown again when nested frames are present — the table renders nested, not pivoted
        expect(item?.showIf?.({ rowsAsFields: true } as Options, [nestedFrame])).toBe(true);
      }
    });
  });
});
