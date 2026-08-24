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
import { SceneDataNode, SceneDataTransformer, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataPaneNext } from '../panel-edit/PanelEditNext/PanelDataPaneNext';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { activateFullSceneTree } from '../utils/test-utils';

import { PanelPluginTransformationsBehaviour } from './PanelPluginTransformationsBehaviour';

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

    if (!plugin) {
      return Promise.reject(new Error(`Plugin ${id} not found`));
    }

    // The real importer writes what it loaded into the cache `syncGetPanelPlugin` reads, so an id is
    // only cold until the first import resolves.
    coldPlugins.delete(id);

    return Promise.resolve(plugin);
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

function buildTransformer(options: {
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

  const transformer = new SceneDataTransformer({
    $data: source,
    transformations: options.userTransformations ?? [],
    $behaviors: [new PanelPluginTransformationsBehaviour()],
  });

  return { source, transformer };
}

function buildPipeline(options: {
  pluginId: string;
  series: DataFrame[];
  annotations?: DataFrame[];
  userTransformations?: SceneDataTransformer['state']['transformations'];
}) {
  const { source, transformer } = buildTransformer(options);
  const panel = new VizPanel({ pluginId: options.pluginId, $data: transformer });

  return { source, transformer, panel };
}

/** Field names of the first output frame. */
function fieldNames(transformer: SceneDataTransformer) {
  return transformer.state.data?.series[0]?.fields.map((f) => f.name);
}

describe('PanelPluginTransformationsBehaviour', () => {
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

  describe('pipeline order', () => {
    it('runs plugin transformations before user transformations', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

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
        expect(fieldNames(transformer)).toEqual(['level', 'time', 'line', 'labels']);
      });
    });

    it('runs appended transformations after user transformations', async () => {
      // `reduce` collapses to one row per field, so it can only produce this shape if it ran after the
      // user's `organize` rather than before it.
      registerPlugin('reducer', (p) =>
        p.setSystemTransformations(() => ({ append: [{ id: 'reduce', options: { reducers: ['count'] } }] }))
      );

      const { transformer } = buildPipeline({
        pluginId: 'reducer',
        series: [frameWithLabels()],
        userTransformations: [{ id: 'organize', options: { excludeByName: { labels: true } } }],
      });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['Field', 'Count']);
      });
      // `labels` is absent, so the user transformation dropped it before the appended reduce saw the
      // frame. (`reduce` drops the time field itself.)
      expect(transformer.state.data?.series[0]?.fields[0].values).toEqual(['line']);
    });

    it('resolves the supplier against the query result rather than the pipeline output', async () => {
      const supplier = jest.fn().mockReturnValue({
        prepend: [extractLabels],
        append: [{ id: 'reduce', options: { reducers: ['count'] } }],
      });
      registerPlugin('both', (p) => p.setSystemTransformations(supplier));

      const series = [frameWithLabels()];
      const { transformer } = buildPipeline({ pluginId: 'both', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['Field', 'Count']);
      });
      // Both positions read the same frames, and neither sees what the other produced
      for (const call of supplier.mock.calls) {
        expect(call[0].series).toBe(series);
      }
    });

    it('nothing the plugin contributes reaches the transformations state', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
      // This is what keeps every reader — persisting, dirty tracking, the editors — on a plain read
      // of `state.transformations`
      expect(transformer.state.transformations).toEqual([]);
    });

    it('keeps applying plugin transformations across an editor add and delete', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      // The editor splices by index over `state.transformations` and writes the result back, so
      // anything of the plugin's living in that array would be deleted here.
      const dataPane = new PanelDataPaneNext({ panelRef: panel.getRef() });
      const index = dataPane.addTransformation('organize');
      expect(index).toBe(0);

      dataPane.deleteTransformation(index!);
      // Deleting re-runs the query rather than the pipeline, and this scene has no query runner,
      // so drive the recompute the way a completing query would.
      transformer.reprocessTransformations();

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
      expect(transformer.state.transformations).toEqual([]);
    });

    it('applies them when the transformer activates before the behaviour, as it does in a scene', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });

      // `_internalActivate` runs a scene object's own handlers, then `$data`, then `$behaviors`, so
      // the transformer's first pass happens before this behaviour has registered anything. The
      // registration is what forces the second pass.
      transformer.activate();

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
    });
  });

  describe('the feature toggle', () => {
    it('does nothing when the feature toggle is off', async () => {
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const series = [frameWithLabels()];
      const { source, transformer } = buildPipeline({ pluginId: 'logs-table', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      // No supplier registered at all, so the transformer keeps its identity-preserving passthrough
      expect(transformer.state.transformations).toEqual([]);
      expect(transformer.state.data === source.state.data).toBe(true);
    });

    it('does not resolve the plugin at all when the feature toggle is off', async () => {
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
      registerPlugin('cold', (p) => p.setSystemTransformations(() => [extractLabels]));
      coldPlugins.add('cold');

      const { transformer } = buildPipeline({ pluginId: 'cold', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      // Every panel of every dashboard carries this behaviour, so an import that could only ever
      // decide to register nothing is a cost the whole product pays while the feature is off.
      // The flag-on counterpart is the cold-plugin test below, which only passes via this import.
      expect(importPanelPlugin).not.toHaveBeenCalled();
    });

    it('keeps applying when the toggle is turned off mid-session, until the page reloads', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { transformer } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      // The flag is read once, when the supplier is registered, so that nothing is registered while
      // the feature is off. The trade is that a flip is only picked up on the next activation --
      // reachable in development through a local-storage override, and by a restart in production.
      setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
      transformer.reprocessTransformations();

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
    });
  });

  describe('the fast path', () => {
    it('passes data through unchanged when the plugin registers no transformations', async () => {
      registerPlugin('plain');

      const series = [frameWithLabels()];
      const { source, transformer } = buildPipeline({ pluginId: 'plain', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      // A registered supplier that resolves to nothing still leaves the effective pipeline empty, so
      // the PanelData object itself is forwarded. Anything less — a rebuilt series array,
      // `annotations` promoted from undefined to [] — is work for every panel on the dashboard.
      expect(transformer.state.data === source.state.data).toBe(true);
      expect(transformer.state.data?.series[0] === series[0]).toBe(true);
    });

    it('passes data through when the plugin resolves to nothing for these frames', async () => {
      registerPlugin('conditional', (p) =>
        p.setSystemTransformations(({ series }) =>
          series[0]?.meta?.preferredVisualisationType === 'logs' ? [extractLabels] : []
        )
      );

      const series = [frameWithLabels()];
      const { source, transformer } = buildPipeline({ pluginId: 'conditional', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(transformer.state.data?.state).toBe(LoadingState.Done);
      });
      expect(transformer.state.data === source.state.data).toBe(true);
    });

    it('never writes the transformations state, so it cannot make the dashboard dirty', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });

      const events: SceneObjectStateChangedEvent[] = [];
      panel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      const transformationsWrites = events.filter((event) =>
        Object.prototype.hasOwnProperty.call(event.payload.partialUpdate ?? {}, 'transformations')
      );

      expect(transformationsWrites).toEqual([]);
      // And every write it does cause is one the change tracker ignores
      for (const event of events) {
        expect(DashboardSceneChangeTracker.isUpdatingPersistedState(event)).toBe(false);
      }
    });
  });

  describe('resolving the plugin', () => {
    it('transforms even when the plugin is not yet in the synchronous cache', async () => {
      registerPlugin('cold', (p) => p.setSystemTransformations(() => [extractLabels]));
      coldPlugins.add('cold');

      const { transformer } = buildPipeline({ pluginId: 'cold', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
    });

    it('applies transformations from a plugin only the panel can resolve', async () => {
      registerPlugin('runtime-only', (p) => p.setSystemTransformations(() => [extractLabels]));
      importerBlindPlugins.add('runtime-only');

      const { panel, transformer } = buildPipeline({ pluginId: 'runtime-only', series: [frameWithLabels()] });
      // Activating the panel loads its plugin, which is what `getPlugin()` reads. Resolving
      // through the importer instead would reject for this id and error the panel's data.
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
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

    it('contains a throwing supplier instead of erroring the panel', async () => {
      registerPlugin('broken', (p) =>
        p.setSystemTransformations(() => {
          throw new Error('supplier blew up');
        })
      );

      // PanelPlugin reports the broken supplier itself, so nothing reaches the pipeline to log.
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { transformer } = buildPipeline({
        pluginId: 'broken',
        series: [frameWithLabels()],
        userTransformations: [{ id: 'reduce', options: { reducers: ['max'] } }],
      });
      activateFullSceneTree(transformer);

      // Registering nothing is the same outcome as a plugin that never called
      // setSystemTransformations: the user's own transformations still run over the query result.
      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['Field', 'Max']);
      });
      expect(transformer.state.data?.state).toBe(LoadingState.Done);
      expect(transformer.state.data?.errors).toBeUndefined();
      // Once, not once per emission and per editor render.
      expect(consoleError).toHaveBeenCalledTimes(1);

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

        const { transformer } = buildTransformer({ series: [frameWithLabels()] });

        panel.setState({ pluginId: realPluginId, $data: transformer });

        return { panel, transformer };
      }

      it('asks the plugin for the current pluginId, not the one still loaded', async () => {
        registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

        const { transformer } = buildSwappingPanel('logs-table');

        // The placeholder registers nothing, so consulting it would pass the frames straight through.
        await waitFor(() => {
          expect(fieldNames(transformer)).toContain('level');
        });
      });

      it('retries once the real plugin lands, though pluginId never changes', async () => {
        // Invisible to both synchronous lookups and to the importer, so nothing can resolve it until
        // the panel itself loads it — the runtime-registered plugin case.
        importerBlindPlugins.add('runtime-logs');
        registerPlugin('runtime-logs', (p) => p.setSystemTransformations(() => [extractLabels]));

        const { panel, transformer } = buildSwappingPanel('runtime-logs');

        await waitFor(() => {
          expect(transformer.state.data?.state).toBe(LoadingState.Done);
        });
        expect(fieldNames(transformer)).toEqual(['time', 'line', 'labels']);

        // `_pluginLoaded` writes `pluginId: plugin.meta.id` — the value already in state.
        importerBlindPlugins.delete('runtime-logs');
        await panel.changePluginType('runtime-logs');

        await waitFor(() => {
          expect(fieldNames(transformer)).toContain('level');
        });
      });
    });
  });

  describe('switching visualization', () => {
    it('re-runs when the panel switches between two plugins that both register transformations', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));
      registerPlugin('reducer', (p) =>
        p.setSystemTransformations(() => [{ id: 'reduce', options: { reducers: ['max'] } }])
      );

      const { transformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      panel.setState({ pluginId: 'reducer' });

      // The supplier reads `pluginId` at call time, so the switch needs no re-registration — only a
      // reprocess, since nothing about it produces new data.
      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['Field', 'Max']);
      });
      expect(transformer.state.transformations).toEqual([]);
    });

    it('returns to the passthrough when the panel switches to a plugin that registers nothing', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));
      registerPlugin('plain');

      const series = [frameWithLabels()];
      const { source, transformer, panel } = buildPipeline({ pluginId: 'logs-table', series });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      panel.setState({ pluginId: 'plain' });

      await waitFor(() => {
        expect(transformer.state.data === source.state.data).toBe(true);
      });
    });
  });

  describe('a cloned panel', () => {
    it('never emits its source panel’s data untransformed', async () => {
      registerPlugin('extracts', (p) => p.setSystemTransformations(() => [extractLabels]));

      const { panel, transformer } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      const clonedPanel = panel.clone();
      const clonedTransformer = clonedPanel.state.$data as SceneDataTransformer;
      const emitted: Array<string[] | undefined> = [];

      clonedTransformer
        .getResultsStream()
        .subscribe((result) => emitted.push(result.data.series[0]?.fields.map((f) => f.name)));

      activateFullSceneTree(clonedPanel);

      await waitFor(() => {
        expect(fieldNames(clonedTransformer)).toContain('level');
      });
      // The clone is constructed from state, which holds no supplier, so its first pass would find an
      // empty pipeline and replace the transformed data it was cloned with. Scenes carries the
      // suppliers onto the clone to stop that.
      expect(emitted).not.toContainEqual(['time', 'line', 'labels']);
    });

    it('binds to its own plugin rather than the panel it was cloned from', async () => {
      registerPlugin('extracts', (p) => p.setSystemTransformations(() => [extractLabels]));
      registerPlugin('plain');

      const { panel, transformer } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
      activateFullSceneTree(panel);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });

      const clonedPanel = panel.clone();
      const clonedTransformer = clonedPanel.state.$data as SceneDataTransformer;

      activateFullSceneTree(clonedPanel);
      await clonedPanel.changePluginType('plain');

      // The clone inherits the source's supplier until its own behaviour re-registers, and that
      // supplier resolves through the transformer it was registered on — so it must not keep
      // answering for the source panel here.
      await waitFor(() => {
        expect(fieldNames(clonedTransformer)).not.toContain('level');
      });
      expect(fieldNames(transformer)).toContain('level');
    });
  });

  it('follows a replaced $data, which arrives carrying its own behaviour', async () => {
    registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

    const { panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
    activateFullSceneTree(panel);

    // What `LibraryPanelBehavior` does once the library panel loads, and `changePanelPlugin` when a
    // panel gains queries: a whole new provider from one of the builders in `dashboard-scene`.
    const { transformer: replacement } = buildTransformer({ series: [frameWithLabels()] });
    panel.setState({ $data: replacement });
    activateFullSceneTree(replacement);

    await waitFor(() => {
      expect(fieldNames(replacement)).toContain('level');
    });
  });

  describe('data topics', () => {
    it('ignores transformations that target a topic other than series', async () => {
      registerPlugin('mixed-topics', (p) =>
        p.setSystemTransformations(() => [
          extractLabels,
          // The contract is series-only, and scenes routes an entry by its own topic — so without the
          // behaviour dropping these they would transform the annotations stream instead.
          {
            id: 'organize',
            options: { indexByName: { level: 0, time: 1, line: 2 }, excludeByName: {} },
            topic: DataTopic.Annotations,
          },
          { id: 'reduce', options: { reducers: ['max'] }, topic: DataTopic.Annotations },
        ])
      );

      const annotation = toDataFrame({
        name: 'anno',
        meta: { dataTopic: DataTopic.Annotations },
        fields: [{ name: 'time', type: FieldType.time, values: [100, 200] }],
      });
      const { transformer } = buildPipeline({
        pluginId: 'mixed-topics',
        series: [frameWithLabels()],
        annotations: [annotation],
      });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toContain('level');
      });
      expect(fieldNames(transformer)).toEqual(['time', 'line', 'labels', 'level']);
      // Untouched: two rows, one field, rather than anything `reduce` would have produced
      expect(transformer.state.data?.annotations).toHaveLength(1);
      expect(transformer.state.data?.annotations?.[0].fields.map((f) => f.name)).toEqual(['time']);
    });

    it('leaves annotation frames on the annotations topic', async () => {
      registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

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
        expect(fieldNames(transformer)).toContain('level');
      });
      // Having any effective transformation moves the panel off the passthrough path, where output
      // frames are re-sorted by topic. Annotations must not end up classified as series.
      expect(transformer.state.data?.annotations).toHaveLength(1);
      expect(transformer.state.data?.series).toHaveLength(1);
    });
  });

  describe('field overrides', () => {
    it('applies overrides to fields produced by a plugin transformation', async () => {
      registerPlugin('logs-table', (p) => {
        p.setSystemTransformations(() => [extractLabels]).useFieldConfig({});
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
        expect(fieldNames(transformer)).toContain('level');
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
        p.setSystemTransformations(() => ({
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
        expect(fieldNames(transformer)).toEqual(['Field', 'Count']);
      });

      const withFieldConfig = panel.applyFieldConfig(transformer.state.data!);
      const count = withFieldConfig.series[0].fields.find((f) => f.name === 'Count');

      expect(count).toBeDefined();
      expect(count!.config.unit).toBe('bytes');
    });
  });
});
