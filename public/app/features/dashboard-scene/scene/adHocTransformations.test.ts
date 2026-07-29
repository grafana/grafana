import {
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelData,
  type PanelPluginMeta,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { getPanelPluginMetasMapSync } from '@grafana/runtime/internal';
import {
  CustomVariable,
  SceneDataNode,
  SceneDataTransformer,
  SceneVariableSet,
  VizPanel,
  type CustomTransformOperator,
} from '@grafana/scenes';
import { type DataTransformerConfig } from '@grafana/schema';
import { type PanelContext } from '@grafana/ui';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import {
  panelSkipsTransformationPipeline,
  setAdHocTransformationsPanelContext,
  syncSkipTransformationsBehavior,
  withEditorOrigin,
} from './adHocTransformations';

// These are normally wired up during app boot. Without them PanelPlugin.fieldConfigRegistry is
// empty and applyFieldOverrides has no standard properties to apply.
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({}).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getPanelPluginMetasMapSync: jest.fn(),
}));

const mockGetPanelPluginMetasMapSync = jest.mocked(getPanelPluginMetasMapSync);

function stubPanelMetas(metas: Record<string, Partial<PanelPluginMeta>>) {
  mockGetPanelPluginMetasMapSync.mockReturnValue(metas as Record<string, PanelPluginMeta>);
}

beforeEach(() => {
  mockGetPanelPluginMetasMapSync.mockReset();
  stubPanelMetas({});
  config.featureToggles.panelAdHocTransformations = true;
});

afterEach(() => {
  config.featureToggles.panelAdHocTransformations = false;
});

describe('panelSkipsTransformationPipeline', () => {
  it('is false when the feature toggle is off', () => {
    config.featureToggles.panelAdHocTransformations = false;
    stubPanelMetas({ table: { adHocTransforms: true } });

    expect(panelSkipsTransformationPipeline('table')).toBe(false);
  });

  it('is true when the plugin declares adHocTransforms', () => {
    stubPanelMetas({ table: { adHocTransforms: true } });

    expect(panelSkipsTransformationPipeline('table')).toBe(true);
  });

  it('is false for a plugin that does not declare it', () => {
    stubPanelMetas({ timeseries: { adHocTransforms: false } });

    expect(panelSkipsTransformationPipeline('timeseries')).toBe(false);
    expect(panelSkipsTransformationPipeline('unknown-plugin')).toBe(false);
    expect(panelSkipsTransformationPipeline(undefined)).toBe(false);
  });

  it('is false when the plugin also declares skipDataQuery, which never gets a transformer', () => {
    stubPanelMetas({ text: { adHocTransforms: true, skipDataQuery: true } });

    expect(panelSkipsTransformationPipeline('text')).toBe(false);
  });

  it('is false when the plugin meta cache is not initialised yet', () => {
    mockGetPanelPluginMetasMapSync.mockImplementation(() => {
      throw new Error('not initialised');
    });

    expect(panelSkipsTransformationPipeline('table')).toBe(false);
  });
});

function buildPanel(
  pluginId: string,
  transformations: Array<DataTransformerConfig | CustomTransformOperator> = [],
  data?: PanelData
) {
  const sourceData: PanelData = data ?? {
    state: LoadingState.Done,
    series: [toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }] })],
    timeRange: { from: {}, to: {}, raw: { from: 'now-6h', to: 'now' } } as PanelData['timeRange'],
  };

  const transformer = new SceneDataTransformer({
    $data: new SceneDataNode({ data: sourceData }),
    transformations,
    $behaviors: [syncSkipTransformationsBehavior],
  });

  const panel = new VizPanel({ pluginId, $data: transformer });

  return { panel, transformer, sourceData };
}

describe('syncSkipTransformationsBehavior', () => {
  it('sets the flag from the panel plugin on activation', () => {
    stubPanelMetas({ table: { adHocTransforms: true } });
    const { panel, transformer } = buildPanel('table');

    panel.activate();
    transformer.activate();

    expect(transformer.state.skipTransformations).toBe(true);
  });

  it('leaves the flag off for a plugin that does not opt in', () => {
    stubPanelMetas({ timeseries: {} });
    const { panel, transformer } = buildPanel('timeseries');

    panel.activate();
    transformer.activate();

    expect(transformer.state.skipTransformations).toBeFalsy();
  });

  it('flips the flag in both directions when the visualization type changes', () => {
    stubPanelMetas({ table: { adHocTransforms: true }, timeseries: {} });
    const { panel, transformer } = buildPanel('table');

    panel.activate();
    transformer.activate();
    expect(transformer.state.skipTransformations).toBe(true);

    panel.setState({ pluginId: 'timeseries' });
    expect(transformer.state.skipTransformations).toBe(false);

    panel.setState({ pluginId: 'table' });
    expect(transformer.state.skipTransformations).toBe(true);
  });

  it('keeps the transformations when the visualization type changes', () => {
    stubPanelMetas({ table: { adHocTransforms: true }, timeseries: {} });
    const transformations: DataTransformerConfig[] = [
      { id: 'organize', options: {}, origin: { source: 'panel', pluginId: 'table' } },
    ];
    const { panel, transformer } = buildPanel('table', transformations);

    panel.activate();
    transformer.activate();

    panel.setState({ pluginId: 'timeseries' });

    expect(transformer.state.transformations).toEqual(transformations);
  });
});

describe('withEditorOrigin', () => {
  it('stamps an editor origin', () => {
    expect(withEditorOrigin({ id: 'organize', options: {} })).toEqual({
      id: 'organize',
      options: {},
      origin: { source: 'editor' },
    });
  });

  it('leaves dashboard JSON untouched when the feature toggle is off', () => {
    config.featureToggles.panelAdHocTransformations = false;

    expect(withEditorOrigin({ id: 'organize', options: {} })).toEqual({ id: 'organize', options: {} });
  });

  it('does not overwrite an existing origin', () => {
    const existing: DataTransformerConfig = { id: 'organize', options: {}, origin: { source: 'panel' } };

    expect(withEditorOrigin(existing)).toBe(existing);
  });
});

describe('setAdHocTransformationsPanelContext', () => {
  function setup(
    pluginId = 'table',
    transformations: Array<DataTransformerConfig | CustomTransformOperator> = [],
    data?: PanelData
  ) {
    const { panel, transformer, sourceData } = buildPanel(pluginId, transformations, data);
    const context = {} as PanelContext;

    setAdHocTransformationsPanelContext(panel, context);

    return { panel, transformer, context, sourceData };
  }

  describe('isAdHocTransformsEnabled', () => {
    it('reflects the current plugin', () => {
      stubPanelMetas({ table: { adHocTransforms: true }, timeseries: {} });
      const { panel, context } = setup('table');

      expect(context.isAdHocTransformsEnabled!()).toBe(true);

      // The context object is memoized by VizPanel, so this has to stay correct after a viz change.
      panel.setState({ pluginId: 'timeseries' });
      expect(context.isAdHocTransformsEnabled!()).toBe(false);
    });
  });

  describe('getTransformations', () => {
    it('returns the pipeline', () => {
      const transformations: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { a: true } } }];
      const { context } = setup('table', transformations);

      expect(context.getTransformations!()).toEqual(transformations);
    });

    it('keeps a stable array identity while unchanged', () => {
      const { context } = setup('table', [{ id: 'organize', options: {} }]);

      expect(context.getTransformations!()).toBe(context.getTransformations!());
    });

    it('returns a new array after the pipeline changes', () => {
      const { context, transformer } = setup('table', [{ id: 'organize', options: {} }]);
      const first = context.getTransformations!();

      transformer.setState({ transformations: [{ id: 'organize', options: { excludeByName: { a: true } } }] });

      expect(context.getTransformations!()).not.toBe(first);
      expect(context.getTransformations!()[0].options).toEqual({ excludeByName: { a: true } });
    });

    it('filters out custom transform operators, which cannot be persisted', () => {
      const customOperator: CustomTransformOperator = () => (source) => source;
      const { context } = setup('table', [{ id: 'organize', options: {} }, customOperator]);

      expect(context.getTransformations!()).toEqual([{ id: 'organize', options: {} }]);
    });

    it('interpolates template variables', () => {
      const { context, panel } = setup('table', [{ id: 'filterByValue', options: { value: '$env' } }]);
      panel.setState({
        $variables: new SceneVariableSet({
          variables: [new CustomVariable({ name: 'env', value: 'prod', text: 'prod', query: 'prod' })],
        }),
      });
      panel.activate();

      expect(context.getTransformations!()[0].options).toEqual({ value: 'prod' });
    });

    it('returns an empty array when the panel has no transformer', () => {
      const panel = new VizPanel({ pluginId: 'table' });
      const context = {} as PanelContext;
      setAdHocTransformationsPanelContext(panel, context);

      expect(context.getTransformations!()).toEqual([]);
    });
  });

  describe('setTransformations', () => {
    it('writes the pipeline to the transformer', () => {
      const { context, transformer } = setup('table', [{ id: 'organize', options: {} }]);
      const next: DataTransformerConfig[] = [{ id: 'limit', options: { limitField: 1 } }];

      context.setTransformations!(next);

      expect(transformer.state.transformations).toEqual(next);
    });

    it('reprocesses so a change takes effect even when the source frames are unchanged', () => {
      const { context, transformer } = setup('table', [{ id: 'organize', options: {} }]);
      const reprocess = jest.spyOn(transformer, 'reprocessTransformations');

      context.setTransformations!([{ id: 'limit', options: { limitField: 1 } }]);

      expect(reprocess).toHaveBeenCalled();
    });
  });

  describe('getUntransformedData', () => {
    it('returns the source data from before the pipeline', () => {
      const { context, sourceData } = setup('table', [{ id: 'organize', options: {} }]);

      expect(context.getUntransformedData!()).toBe(sourceData);
    });

    it('honours the series limit the renderer would apply', () => {
      const series = [
        toDataFrame({ refId: 'A', fields: [{ name: 'a', type: FieldType.number, values: [1] }] }),
        toDataFrame({ refId: 'B', fields: [{ name: 'b', type: FieldType.number, values: [2] }] }),
      ];
      const { context, panel } = setup('table', [], { state: LoadingState.Done, series } as PanelData);

      panel.setState({ seriesLimit: 1 });
      expect(context.getUntransformedData!()!.series).toHaveLength(1);

      panel.setState({ seriesLimitShowAll: true });
      expect(context.getUntransformedData!()!.series).toHaveLength(2);
    });

    // Callers use `series` as a hook dependency, so a fresh slice per call would loop forever.
    it('returns a stable identity while the source data and limit are unchanged', () => {
      const series = [
        toDataFrame({ refId: 'A', fields: [{ name: 'a', type: FieldType.number, values: [1] }] }),
        toDataFrame({ refId: 'B', fields: [{ name: 'b', type: FieldType.number, values: [2] }] }),
      ];
      const { context, panel } = setup('table', [], { state: LoadingState.Done, series } as PanelData);
      panel.setState({ seriesLimit: 1 });

      expect(context.getUntransformedData!()).toBe(context.getUntransformedData!());
      expect(context.getUntransformedData!()!.series).toBe(context.getUntransformedData!()!.series);
    });
  });

  describe('applyFieldConfig', () => {
    function setupWithPlugin() {
      const { panel, transformer, context, sourceData } = setup('table');
      // getPlugin() only resolves once the plugin has loaded.
      panel.activate();
      transformer.activate();
      return { panel, context, sourceData };
    }

    it('applies field config defaults to the given data', async () => {
      const { panel, context, sourceData } = setupWithPlugin();
      await new Promise(process.nextTick);
      panel.setState({ fieldConfig: { defaults: { unit: 'bytes' }, overrides: [] } });

      const result = context.applyFieldConfig!(sourceData);

      expect(result.series[0].fields[0].config.unit).toBe('bytes');
    });

    it('does not disturb the panel structureRev, which would thrash uPlot and table column widths', async () => {
      const { panel, context, sourceData } = setupWithPlugin();
      await new Promise(process.nextTick);

      const first = panel.applyFieldConfig(sourceData).structureRev;

      // A panel that owns its pipeline calls this every render with different frames.
      context.applyFieldConfig!({
        ...sourceData,
        series: [toDataFrame({ fields: [{ name: 'other', type: FieldType.string, values: ['x'] }] })],
      });

      expect(panel.applyFieldConfig(sourceData).structureRev).toBe(first);
    });

    // setFieldConfigDefaults *pushes* panel default links onto whatever the frame already carries,
    // so this must only ever be handed pre-field-config data. getUntransformedData() guarantees
    // that; passing already-processed frames would accumulate a link per call.
    it('applies panel default links exactly once to raw frames', async () => {
      const { panel, context } = setupWithPlugin();
      await new Promise(process.nextTick);

      panel.setState({
        fieldConfig: { defaults: { links: [{ title: 'Go', url: 'http://example.com' }] }, overrides: [] },
      });

      const frames: DataFrame[] = [toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] })];
      const result = context.applyFieldConfig!({ state: LoadingState.Done, series: frames } as PanelData);

      expect(result.series[0].fields[0].config.links).toHaveLength(1);
    });

    it('merges datasource-provided links with the panel defaults', async () => {
      const { panel, context } = setupWithPlugin();
      await new Promise(process.nextTick);

      panel.setState({
        fieldConfig: { defaults: { links: [{ title: 'Panel', url: 'http://panel.example' }] }, overrides: [] },
      });

      const frames: DataFrame[] = [
        toDataFrame({
          fields: [
            {
              name: 'value',
              type: FieldType.number,
              values: [1],
              config: { links: [{ title: 'Datasource', url: 'http://ds.example' }] },
            },
          ],
        }),
      ];
      const result = context.applyFieldConfig!({ state: LoadingState.Done, series: frames } as PanelData);

      expect(result.series[0].fields[0].config.links?.map((l) => l.title)).toEqual(['Datasource', 'Panel']);
    });
  });
});
