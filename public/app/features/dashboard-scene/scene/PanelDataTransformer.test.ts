import { waitFor } from '@testing-library/react';

import {
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelPlugin,
  getDefaultTimeRange,
  getFieldDisplayName,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, type SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataPaneNext } from '../panel-edit/PanelEditNext/PanelDataPaneNext';
import { activateFullSceneTree } from '../utils/test-utils';

import { PanelDataTransformer } from './PanelDataTransformer';

const plugins = new Map<string, PanelPlugin>();
/** Plugin ids that must be awaited rather than resolved from the synchronous cache. */
const coldPlugins = new Set<string>();
/**
 * Plugin ids invisible to Grafana's importer, mirroring runtime panel plugins: those live in a
 * registry inside scenes (reached below through `setPluginImportUtils` and `VizPanel.getPlugin`),
 * while `importPanelPlugin` rejects for their ids.
 */
const importerBlindPlugins = new Set<string>();

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) =>
    coldPlugins.has(id) || importerBlindPlugins.has(id) ? undefined : plugins.get(id),
  importPanelPlugin: (id: string) => {
    const plugin = importerBlindPlugins.has(id) ? undefined : plugins.get(id);
    return plugin ? Promise.resolve(plugin) : Promise.reject(new Error(`Plugin ${id} not found`));
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(plugins.get(id)!),
  getPanelPluginFromCache: (id: string) => plugins.get(id),
});

function registerPlugin(id: string, configure?: (plugin: PanelPlugin) => void) {
  const plugin = getPanelPlugin({ id });
  configure?.(plugin);
  plugins.set(id, plugin);
  return plugin;
}

/** A frame with a JSON `labels` column, the shape the logs table extracts fields out of. */
function frameWithLabels(): DataFrame {
  return toDataFrame({
    name: 'logs',
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200] },
      { name: 'line', type: FieldType.string, values: ['a', 'b'] },
      { name: 'labels', type: FieldType.string, values: ['{"level":"info"}', '{"level":"warn"}'] },
    ],
  });
}

const extractLabels = {
  id: 'extractFields',
  options: { format: 'json', keepTime: false, replace: false, source: 'labels' },
};

function buildPipeline(options: {
  pluginId: string;
  series: DataFrame[];
  annotations?: DataFrame[];
  userTransformations?: SceneDataTransformer['state']['transformations'];
}) {
  const source = new SceneDataNode({
    data: {
      state: LoadingState.Done,
      series: options.series,
      annotations: options.annotations,
      timeRange: getDefaultTimeRange(),
    },
  });

  const transformer = new PanelDataTransformer({
    $data: source,
    transformations: options.userTransformations ?? [],
  });
  const panel = new VizPanel({ pluginId: options.pluginId, $data: transformer });

  return { source, transformer, panel };
}

/** Field names of the first output frame once the pipeline has settled. */
async function outputFieldNames(transformer: PanelDataTransformer) {
  return waitFor(() => {
    const names = transformer.state.data?.series[0]?.fields.map((f) => f.name);
    expect(names).toBeDefined();
    return names!;
  });
}

describe('PanelDataTransformer', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  beforeEach(() => {
    plugins.clear();
    coldPlugins.clear();
    importerBlindPlugins.clear();
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  it('runs plugin transformations before user transformations', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { transformer } = buildPipeline({
      pluginId: 'logs-table',
      series: [frameWithLabels()],
      // Only resolves to a real field ordering if `extractFields` already produced `level`.
      userTransformations: [
        { id: 'organize', options: { indexByName: { level: 0, time: 1, line: 2 }, excludeByName: {} } },
      ],
    });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['level', 'time', 'line', 'labels']);
    });
  });

  it('keeps the plugin transformations out of the editable transformations list', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    // Everything that reads, edits or persists a panel's transformations reads this field.
    expect(transformer.state.transformations).toEqual([]);
    expect(transformer.getEffectiveTransformations()).toHaveLength(1);
  });

  it('does nothing when the feature toggle is off', async () => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const series = [frameWithLabels()];
    const { transformer } = buildPipeline({ pluginId: 'logs-table', series });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
    });
    expect(transformer.state.systemTransformations).toBeUndefined();
    // No effective transformations means the base class keeps its identity-preserving fast path.
    expect(transformer.state.data?.series === series).toBe(true);
  });

  it('stops applying plugin transformations when the toggle is turned off mid-session', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['time', 'line', 'labels', 'level']);
    });

    // The flag is read per emission rather than cached at construction, so turning it off has to
    // take effect on a panel that is already applying them — without reconstructing the scene.
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
    transformer.reprocessTransformations();

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['time', 'line', 'labels']);
    });
  });

  it('passes data through unchanged when the plugin registers no transformations', async () => {
    registerPlugin('plain');

    const series = [frameWithLabels()];
    const { transformer } = buildPipeline({ pluginId: 'plain', series });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
    });
    // Scenes rebuilds the series array whenever a transformer has any entry, so the array itself
    // is new. What must hold is that the frames pass through untouched, so no extra work lands
    // downstream in structure comparison or field overrides.
    expect(transformer.state.data?.series[0] === series[0]).toBe(true);
  });

  it('lets the supplier branch on frame metadata', async () => {
    registerPlugin('graph', (p) =>
      p.setDataTransformations(({ series }) =>
        series[0]?.meta?.preferredVisualisationType === 'nodeGraph' ? [extractLabels] : []
      )
    );

    const longFrame = frameWithLabels();
    longFrame.meta = { preferredVisualisationType: 'nodeGraph' };
    const matching = buildPipeline({ pluginId: 'graph', series: [longFrame] });
    activateFullSceneTree(matching.transformer);

    await waitFor(() => {
      expect(matching.transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    const other = buildPipeline({ pluginId: 'graph', series: [frameWithLabels()] });
    activateFullSceneTree(other.transformer);

    await waitFor(() => {
      expect(other.transformer.state.data?.state).toBe(LoadingState.Done);
    });
    expect(await outputFieldNames(other.transformer)).not.toContain('level');
  });

  it('ignores transformations that target a topic other than series', async () => {
    registerPlugin('mixed-topics', (p) =>
      p.setDataTransformations(() => [
        // Only series frames reach the plugin operator, so this would collapse the frame into
        // reducer rows if it were misapplied to series data instead of being dropped.
        extractLabels,
        {
          id: 'organize',
          options: { indexByName: { level: 0, time: 1, line: 2 }, excludeByName: {} },
          topic: DataTopic.Annotations,
        },
        { id: 'reduce', options: { reducers: ['max'] }, topic: DataTopic.Annotations },
      ])
    );

    const { transformer } = buildPipeline({ pluginId: 'mixed-topics', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    // The series-topic transformation ran while the original fields survived the dropped ones.
    expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['time', 'line', 'labels', 'level']);
  });

  it('leaves annotation frames on the annotations topic', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const annotation = toDataFrame({
      name: 'anno',
      meta: { dataTopic: DataTopic.Annotations },
      fields: [{ name: 'time', type: FieldType.time, values: [100] }],
    });
    const { transformer } = buildPipeline({
      pluginId: 'logs-table',
      series: [frameWithLabels()],
      annotations: [annotation],
    });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    // Having any effective transformation moves the panel off the passthrough path, where output
    // frames are re-sorted by topic. Annotations must not end up classified as series.
    expect(transformer.state.data?.annotations).toHaveLength(1);
    expect(transformer.state.data?.series).toHaveLength(1);
  });

  it('transforms even when the plugin is not yet in the synchronous cache', async () => {
    registerPlugin('cold', (p) => p.setDataTransformations(() => [extractLabels]));
    coldPlugins.add('cold');

    const { transformer } = buildPipeline({ pluginId: 'cold', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
  });

  it('applies transformations from a plugin only the panel can resolve', async () => {
    registerPlugin('runtime-only', (p) => p.setDataTransformations(() => [extractLabels]));
    importerBlindPlugins.add('runtime-only');

    const { panel, transformer } = buildPipeline({ pluginId: 'runtime-only', series: [frameWithLabels()] });
    // Activating the panel loads its plugin, which is what `getPlugin()` reads. Resolving
    // through the importer instead would reject for this id and error the panel's data.
    activateFullSceneTree(panel);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
  });

  it('passes data through when the plugin id resolves nowhere', async () => {
    // The unconfigured-panel scenario: a fresh panel's id is unknown to the importer and the
    // panel has not loaded a plugin. Resolution failure must degrade to pass-through — erroring
    // here would break every newly added panel while its data still streams in.
    const series = [frameWithLabels()];
    const { transformer } = buildPipeline({ pluginId: 'not-installed', series });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
    });
    expect(transformer.state.data?.errors).toBeUndefined();
    expect(transformer.state.data?.series[0] === series[0]).toBe(true);
  });

  it('re-runs the supplier when the panel switches visualization', async () => {
    registerPlugin('extracts', (p) => p.setDataTransformations(() => [extractLabels]));
    registerPlugin('plain');

    const { transformer, panel } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    // No new data arrives on a viz type change, so only the pluginId subscription can drive this.
    await panel.changePluginType('plain');

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).not.toContain('level');
    });
  });

  it('binds a cloned panel to its own plugin rather than the source panel it was cloned from', async () => {
    registerPlugin('extracts', (p) => p.setDataTransformations(() => [extractLabels]));
    registerPlugin('plain');

    const { panel, transformer } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
    const clonedPanel = panel.clone();
    const clonedTransformer = clonedPanel.state.$data as PanelDataTransformer;

    activateFullSceneTree(panel);
    activateFullSceneTree(clonedPanel);

    await waitFor(() => {
      expect(clonedTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    // `cloneDeep` copies nested functions by reference, so an operator that was not re-created by
    // the constructor would still walk up to the *source* panel and keep extracting fields here.
    await clonedPanel.changePluginType('plain');

    await waitFor(() => {
      expect(clonedTransformer.state.data?.series[0]?.fields.map((f) => f.name)).not.toContain('level');
    });
    expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
  });

  it('keeps applying plugin transformations across an editor add and delete', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
    activateFullSceneTree(panel);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    // The editor splices by index over the filtered `transformations` array and writes the result
    // back, so anything of the plugin's living in that array would be deleted here.
    const dataPane = new PanelDataPaneNext({ panelRef: panel.getRef() });
    const index = dataPane.addTransformation('organize');
    expect(index).toBe(0);

    dataPane.deleteTransformation(index!);
    // Deleting re-runs the query rather than the pipeline, and this scene has no query runner,
    // so drive the recompute the way a completing query would.
    transformer.reprocessTransformations();

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    expect(transformer.state.transformations).toEqual([]);
  });

  it('surfaces a failing supplier as a panel data error', async () => {
    registerPlugin('broken', (p) =>
      p.setDataTransformations(() => {
        throw new Error('supplier blew up');
      })
    );

    // Scenes logs the failure itself before turning it into panel data.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { transformer } = buildPipeline({
      pluginId: 'broken',
      series: [frameWithLabels()],
      userTransformations: [{ id: 'reduce', options: { reducers: ['max'] } }],
    });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Error);
    });
    expect(transformer.state.data?.errors?.[0].message).toContain('supplier blew up');
    // One pipeline means one error boundary: the user's transformations do not run either, and
    // the panel falls back to the untransformed frames.
    expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['time', 'line', 'labels']);

    consoleError.mockRestore();
  });

  describe('field overrides', () => {
    it('applies overrides to fields produced by a plugin transformation', async () => {
      registerPlugin('logs-table', (p) => {
        p.setDataTransformations(() => [extractLabels]).useFieldConfig({});
      });

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      panel.setState({
        fieldConfig: {
          defaults: { links: [{ title: 'Default link', url: 'http://default' }] },
          overrides: [
            {
              // `level` only exists because the plugin transformation ran.
              matcher: { id: 'byName', options: 'level' },
              properties: [
                { id: 'unit', value: 'bytes' },
                { id: 'displayName', value: 'Log level' },
              ],
            },
          ],
        },
      });
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });

      const withFieldConfig = panel.applyFieldConfig(transformer.state.data!);
      const frame = withFieldConfig.series[0];
      const level = frame.fields.find((f) => f.name === 'level');

      expect(level).toBeDefined();
      expect(level!.config.unit).toBe('bytes');
      expect(level!.config.displayName).toBe('Log level');
      expect(getFieldDisplayName(level!, frame, withFieldConfig.series)).toBe('Log level');
      // Proves applyFieldOverrides actually walked the derived field rather than the panel
      // having to run its own pass afterwards.
      expect(level!.state?.seriesIndex).toBeDefined();
      // A second override pass would append the panel default link again.
      expect(level!.config.links).toHaveLength(1);
    });
  });
});
