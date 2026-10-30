import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  type PanelInteraction,
  PanelPlugin,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { TableCellDisplayMode } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { plugin } from './module';
import { tableSuggestionsSupplier } from './suggestions';

// building the plugin's fieldConfigRegistry runs the table useCustomConfig path,
// which resolves the 'stats-picker' standard editor; initialise the registry so
// this file does not depend on another test having done so first
standardEditorsRegistry.setInit(getAllOptionEditors);
// the standard properties (displayName, unit, ...) only reach the plugin's registry if this is
// initialised too - createFieldConfigRegistry reads it to decide what to register
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

function customConfigItem(path: string) {
  const item = plugin.fieldConfigRegistry.list().find((i) => i.path === path);
  if (!item) {
    throw new Error(`no custom field config option registered at path "${path}"`);
  }
  return item;
}

describe('table module', () => {
  afterEach(() => setTestFlags({}));

  it.each([
    { refresh: false, newFeatures: false, shown: true },
    { refresh: true, newFeatures: false, shown: true },
    { refresh: false, newFeatures: true, shown: true },
    { refresh: true, newFeatures: true, shown: false },
  ])(
    'offers the Column filter setting and new override when refresh=$refresh and newFeatures=$newFeatures',
    ({ refresh, newFeatures, shown }) => {
      setTestFlags({ [FlagKeys.TableRefresh]: refresh, [FlagKeys.TableRefreshNewFeatures]: newFeatures });
      const filterable = customConfigItem('filterable');

      expect(filterable.showIf?.({}, undefined)).toBe(shown);
      expect(filterable.showIfOverride?.({ data: [] })).toBe(shown);
    }
  );

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

  it('replaces inherited footer calculations with override values', () => {
    expect(customConfigItem('footer.reducers').arrayOverrideStrategy).toBe('replace');
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

  describe('"Display name" visibility', () => {
    const displayNameItem = () => {
      const item = plugin.fieldConfigRegistry.getIfExists('displayName');
      if (!item) {
        throw new Error('expected the standard displayName property to stay registered');
      }
      return item;
    };

    const showIf = (defaults: { displayName?: string }) => displayNameItem().showIf!(defaults, undefined);

    it('is hidden for a panel that has never set one', () => {
      expect(showIf({})).toBe(false);
    });

    it('is shown for a panel that already has one, so the value can be seen and cleared', () => {
      expect(showIf({ displayName: 'Total' })).toBe(true);
    });

    it('is hidden for a legacy empty value', () => {
      expect(showIf({ displayName: '' })).toBe(false);
    });

    it('stays available for override rules, where renaming a single column is valid', () => {
      expect(displayNameItem().hideFromOverrides).toBeFalsy();
    });
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

  it('declares a single organize interaction for hidden and reordered columns', () => {
    expect(plugin.panelInteractions?.interactions).toEqual([
      expect.objectContaining({
        id: 0,
        name: 'organize',
        mutates: ['TRANSFORMATION'],
        schema: ['hiddenColumns', 'reindexedColumns'],
      }),
    ]);
  });

  const savedReduce = { kind: 'Transformation' as const, group: 'reduce', spec: { options: { reducers: ['max'] } } };

  function dashboardWith(elements: DashboardV2Spec['elements']): DashboardV2Spec {
    return { title: 'Dashboard', elements } as DashboardV2Spec;
  }

  function panel(transformations: Array<typeof savedReduce>) {
    return {
      kind: 'Panel' as const,
      spec: {
        id: 1,
        title: 'Table',
        links: [],
        data: { kind: 'QueryGroup' as const, spec: { queries: [], transformations, queryOptions: {} } },
        vizConfig: {
          kind: 'VizConfig' as const,
          group: 'table',
          version: '',
          spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
        },
      },
    };
  }

  const hideColumnA = {
    id: 'organize',
    filter: { id: 'byRefId', options: 'A' },
    options: { excludeByName: { a: true }, indexByName: {}, renameByName: {} },
  };

  describe('organize interaction promotion', () => {
    const promote: PanelInteraction['promotionPath'] = (dashboard, context) =>
      plugin.panelInteractions!.interactions[0].promotionPath(dashboard, context);

    it('appends the ad hoc transformations after the saved transformations, as v2 transformation kinds', () => {
      const dashboard = dashboardWith({ 'panel-1': panel([savedReduce]) });

      const result = promote(dashboard, { elementKey: 'panel-1', transformations: [hideColumnA] });

      expect(result.elements['panel-1']).toMatchObject({
        spec: {
          data: {
            spec: {
              transformations: [
                savedReduce,
                {
                  kind: 'Transformation',
                  group: 'organize',
                  spec: {
                    filter: { id: 'byRefId', options: 'A' },
                    options: { excludeByName: { a: true }, indexByName: {}, renameByName: {} },
                  },
                },
              ],
            },
          },
        },
      });
    });

    it('leaves other panels and the input dashboard unchanged', () => {
      const dashboard = dashboardWith({ 'panel-1': panel([]), 'panel-2': panel([savedReduce]) });

      const result = promote(dashboard, { elementKey: 'panel-1', transformations: [hideColumnA] });

      expect(result.elements['panel-2']).toBe(dashboard.elements['panel-2']);
      expect(dashboard.elements['panel-1']).toEqual(panel([]));
    });

    it('does not change library panels, whose transformations are not stored in the dashboard', () => {
      const dashboard = dashboardWith({
        'panel-1': { kind: 'LibraryPanel', spec: { id: 1, title: 'Lib', libraryPanel: { uid: 'lib', name: 'Lib' } } },
      });

      expect(promote(dashboard, { elementKey: 'panel-1', transformations: [hideColumnA] })).toBe(dashboard);
    });
  });
});
