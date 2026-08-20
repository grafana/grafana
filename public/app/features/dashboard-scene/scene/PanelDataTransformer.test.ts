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
import {
  SceneDataNode,
  type SceneDataTransformer,
  SceneObjectStateChangedEvent,
  VizPanel,
  isSystemTransformation,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataPaneNext } from '../panel-edit/PanelEditNext/PanelDataPaneNext';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { activateFullSceneTree } from '../utils/test-utils';

import { PanelDataTransformer } from './PanelDataTransformer';
import { NO_SYSTEM_TRANSFORMATIONS, getUserTransformations } from './systemTransformations';

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
  importPanelPlugin: jest.fn((id: string) => {
    const plugin = importerBlindPlugins.has(id) ? undefined : plugins.get(id);
    return plugin ? Promise.resolve(plugin) : Promise.reject(new Error(`Plugin ${id} not found`));
  }),
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
    jest.mocked(importPanelPlugin).mockClear();
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

  it('runs appended transformations after user transformations', async () => {
    // `reduce` collapses to one row per field, so it can only produce this shape if it ran after the
    // user's `organize` rather than before it.
    registerPlugin('reducer', (p) =>
      p.setDataTransformations(() => ({ append: [{ id: 'reduce', options: { reducers: ['count'] } }] }))
    );

    const { transformer } = buildPipeline({
      pluginId: 'reducer',
      series: [frameWithLabels()],
      userTransformations: [{ id: 'organize', options: { excludeByName: { labels: true } } }],
    });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['Field', 'Count']);
    });
    // `labels` is absent, so the user transformation dropped it before the appended reduce saw the
    // frame. (`reduce` drops the time field itself.)
    expect(transformer.state.data?.series[0]?.fields[0].values).toEqual(['line']);
  });

  it('wraps user transformations when the plugin registers both positions', async () => {
    registerPlugin('both', (p) =>
      p.setDataTransformations(() => ({
        prepend: [extractLabels],
        append: [{ id: 'reduce', options: { reducers: ['count'] } }],
      }))
    );

    const { transformer } = buildPipeline({
      pluginId: 'both',
      // Only reaches the appended reduce with a `level` field if the prepend ran before the user's.
      series: [frameWithLabels()],
      userTransformations: [{ id: 'organize', options: { excludeByName: { labels: true, time: true } } }],
    });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['Field', 'Count']);
    });
    expect(transformer.state.data?.series[0]?.fields[0].values).toEqual(['line', 'level']);
  });

  it('installs both wrapper operators even when the plugin registers only one position', async () => {
    // Which half is non-empty depends on the frames, so it is not knowable at install time.
    registerPlugin('appender', (p) =>
      p.setDataTransformations(() => ({ append: [{ id: 'reduce', options: { reducers: ['count'] } }] }))
    );

    const { transformer } = buildPipeline({ pluginId: 'appender', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.transformations).toHaveLength(2);
    });
    expect(transformer.state.transformations.map((t) => (isSystemTransformation(t) ? t.position : null))).toEqual([
      'prepend',
      'append',
    ]);
  });

  it('hands the supplier the query result frames from both positions', async () => {
    const supplier = jest.fn().mockReturnValue({
      prepend: [extractLabels],
      append: [{ id: 'reduce', options: { reducers: ['count'] } }],
    });
    registerPlugin('both', (p) => p.setDataTransformations(supplier));

    const series = [frameWithLabels()];
    const { transformer } = buildPipeline({ pluginId: 'both', series });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['Field', 'Count']);
    });

    // The appended operator is handed post-user frames, but the supplier's documented context is the
    // query result — so every call has to see the source frames, not whatever reached that position.
    expect(supplier).toHaveBeenCalled();
    for (const call of supplier.mock.calls) {
      expect(call[0].series).toBe(series);
    }
  });

  it('resolves the supplier once per emission', async () => {
    const supplier = jest.fn().mockReturnValue({ prepend: [extractLabels], append: [] });
    registerPlugin('both', (p) => p.setDataTransformations(supplier));

    const { transformer } = buildPipeline({ pluginId: 'both', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    // Both operators consult the resolver, and the editor may read it too; the cache is what keeps
    // that to a single supplier call for one set of frames.
    expect(supplier).toHaveBeenCalledTimes(1);

    transformer.getResolvedSystemTransformations(transformer.state.$data!.state.data!.series);
    expect(supplier).toHaveBeenCalledTimes(1);
  });

  describe('getResolvedSystemTransformations', () => {
    it('returns the shared empty result when the feature toggle is off', async () => {
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

      const series = [frameWithLabels()];
      const { transformer } = buildPipeline({ pluginId: 'logs-table', series });
      activateFullSceneTree(transformer);

      expect(transformer.getResolvedSystemTransformations(series)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    });

    it('returns the shared empty result for an empty frame set', async () => {
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

      const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      expect(transformer.getResolvedSystemTransformations([])).toBe(NO_SYSTEM_TRANSFORMATIONS);
    });

    it('returns the shared empty result when the plugin resolves to nothing for these frames', async () => {
      registerPlugin('conditional', (p) =>
        p.setDataTransformations(({ series }) => (series[0]?.meta?.custom?.extract ? [extractLabels] : []))
      );

      const series = [frameWithLabels()];
      const { transformer } = buildPipeline({ pluginId: 'conditional', series });
      activateFullSceneTree(transformer);

      expect(transformer.getResolvedSystemTransformations(series)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    });

    it('drops configs targeting a topic other than series', async () => {
      registerPlugin('annotator', (p) =>
        p.setDataTransformations(() => ({
          prepend: [extractLabels, { ...extractLabels, topic: DataTopic.Annotations }],
          append: [{ id: 'reduce', options: {}, topic: DataTopic.Annotations }],
        }))
      );

      const series = [frameWithLabels()];
      const { transformer } = buildPipeline({ pluginId: 'annotator', series });
      activateFullSceneTree(transformer);

      const resolved = transformer.getResolvedSystemTransformations(series);
      expect(resolved.prepend).toEqual([extractLabels]);
      expect(resolved.append).toEqual([]);
    });
  });

  it('keeps the plugin transformations out of the editable transformations list', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    // Both wrapper operators live in `transformations`, so what keeps them out of editors and save
    // models is the `origin` tag rather than a separate field.
    expect(transformer.state.transformations).toHaveLength(2);
    expect(getUserTransformations(transformer.state.transformations)).toEqual([]);
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
    expect(transformer.state.transformations).toEqual([]);
    // An empty transformations list means the base class keeps its identity-preserving fast path.
    expect(transformer.state.data?.series === series).toBe(true);
  });

  it('does not resolve the plugin at all when the feature toggle is off', async () => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
    registerPlugin('cold', (p) => p.setDataTransformations(() => [extractLabels]));
    coldPlugins.add('cold');

    const { transformer } = buildPipeline({ pluginId: 'cold', series: [frameWithLabels()] });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
    });
    // Every panel of every dashboard is a `PanelDataTransformer`, so an import that could only ever
    // decide to install nothing is a cost the whole product pays while this feature is off.
    // The flag-on counterpart is the cold-plugin test below, which only passes via this import.
    expect(importPanelPlugin).not.toHaveBeenCalled();
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
    const { source, transformer } = buildPipeline({ pluginId: 'plain', series });
    activateFullSceneTree(transformer);

    await waitFor(() => {
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
    });
    // Nothing is installed at all, so the base class keeps its passthrough and the PanelData object
    // itself is forwarded. Anything less — a rebuilt series array, `annotations` promoted from
    // undefined to [] — is downstream work for every panel on the dashboard.
    expect(transformer.state.transformations).toEqual([]);
    expect(transformer.state.data === source.state.data).toBe(true);
    expect(transformer.state.data?.series[0] === series[0]).toBe(true);
  });

  describe('installing the operator', () => {
    it('leaves it off for a plugin that registers nothing, keeping the base class fast path', async () => {
      registerPlugin('plain');

      const { transformer } = buildPipeline({ pluginId: 'plain', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      expect(transformer.state.transformations).toEqual([]);
    });

    it('removes it when the panel switches to a plugin that registers nothing', async () => {
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));
      registerPlugin('plain');

      const series = [frameWithLabels()];
      const { source, transformer, panel } = buildPipeline({ pluginId: 'logs-table', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });

      panel.setState({ pluginId: 'plain' });

      // Back to the fast path rather than an installed operator that resolves to no configs.
      await waitFor(() => {
        expect(transformer.state.transformations).toEqual([]);
      });
      expect(transformer.state.data === source.state.data).toBe(true);
    });

    it('does not mark the dashboard dirty when it installs', async () => {
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });

      // Installing happens with a parent attached now, so — unlike a write from the constructor —
      // the event really does bubble to the dashboard's change tracker.
      const events: SceneObjectStateChangedEvent[] = [];
      panel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.transformations).toHaveLength(2);
      });

      const installEvent = events.find((event) =>
        Object.prototype.hasOwnProperty.call(event.payload.partialUpdate ?? {}, 'transformations')
      );

      expect(installEvent).toBeDefined();
      expect(DashboardSceneChangeTracker.isUpdatingPersistedState(installEvent!)).toBe(false);
    });

    it('re-runs when the panel switches between two plugins that both register transformations', async () => {
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));
      registerPlugin('reducer', (p) =>
        p.setDataTransformations(() => [{ id: 'reduce', options: { reducers: ['max'] } }])
      );

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });

      const installed = transformer.state.transformations;
      panel.setState({ pluginId: 'reducer' });

      // The operators stay installed across this swap, but their keys carry the plugin id, so the base
      // class sees a real change: it replaces the array and reprocesses on its own.
      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['Field', 'Max']);
      });
      expect(transformer.state.transformations).not.toBe(installed);
      expect(transformer.state.transformations).toHaveLength(2);
    });
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

    // Clone only once the source has actually installed, otherwise there is nothing in its state for
    // the constructor's filter to drop and the case this test exists for is never exercised.
    activateFullSceneTree(panel);
    await waitFor(() => {
      expect(transformer.state.transformations).toHaveLength(2);
    });

    const clonedPanel = panel.clone();
    const clonedTransformer = clonedPanel.state.$data as PanelDataTransformer;

    // The clone arrives with the source's entries stripped, then installs its own on activation.
    expect(clonedTransformer.state.transformations).toEqual([]);

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
    expect(getUserTransformations(transformer.state.transformations)).toEqual([]);
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

  /**
   * A library panel is built on a placeholder plugin, then `setPanelFromLibPanel` writes the real
   * `pluginId` and a fresh data provider in one `setState` and kicks off `changePluginType`. So this
   * provider activates while the panel still holds a plugin for a *different* id, and the plugin it
   * is waiting for arrives under `pluginId`'s own value — invisible to a pluginId-change check.
   */
  describe('a panel holding a plugin for another pluginId', () => {
    /** Mirrors the sequence above, leaving the placeholder loaded on the panel. */
    function buildSwappingPanel(realPluginId: string) {
      registerPlugin('loading-placeholder');

      const panel = new VizPanel({ pluginId: 'loading-placeholder' });
      activateFullSceneTree(panel);
      expect(panel.getPlugin()?.meta.id).toBe('loading-placeholder');

      const transformer = new PanelDataTransformer({
        $data: new SceneDataNode({
          data: { state: LoadingState.Done, series: [frameWithLabels()], timeRange: getDefaultTimeRange() },
        }),
        transformations: [],
      });

      panel.setState({ pluginId: realPluginId, $data: transformer });

      return { panel, transformer };
    }

    it('asks the plugin for the current pluginId, not the one still loaded', async () => {
      registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

      const { transformer } = buildSwappingPanel('logs-table');

      // The placeholder registers nothing, so consulting it would pass the frames straight through.
      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });
    });

    it('retries once the real plugin lands, though pluginId never changes', async () => {
      // Invisible to both synchronous lookups and to the importer, so nothing can resolve it until
      // the panel itself loads it — the runtime-registered plugin case.
      importerBlindPlugins.add('runtime-logs');
      registerPlugin('runtime-logs', (p) => p.setDataTransformations(() => [extractLabels]));

      const { panel, transformer } = buildSwappingPanel('runtime-logs');

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['time', 'line', 'labels']);

      // `_pluginLoaded` writes `pluginId: plugin.meta.id` — the value already in state.
      importerBlindPlugins.delete('runtime-logs');
      await panel.changePluginType('runtime-logs');

      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });
    });
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

    it('applies overrides to fields produced by an appended plugin transformation', async () => {
      // Appended transformations run after every user transformation, but still inside the data
      // provider — so overrides, which are applied to the provider's output, see their fields just
      // as they see a prepended one's.
      registerPlugin('reducer', (p) => {
        p.setDataTransformations(() => ({
          append: [{ id: 'reduce', options: { reducers: ['count'] } }],
        })).useFieldConfig({});
      });

      const { transformer, panel } = buildPipeline({ pluginId: 'reducer', series: [frameWithLabels()] });
      panel.setState({
        fieldConfig: {
          defaults: {},
          overrides: [
            {
              // `Count` only exists because the appended reduce ran.
              matcher: { id: 'byName', options: 'Count' },
              properties: [{ id: 'unit', value: 'bytes' }],
            },
          ],
        },
      });
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(transformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual(['Field', 'Count']);
      });

      const withFieldConfig = panel.applyFieldConfig(transformer.state.data!);
      const count = withFieldConfig.series[0].fields.find((f) => f.name === 'Count');

      expect(count).toBeDefined();
      expect(count!.config.unit).toBe('bytes');
    });
  });
});
