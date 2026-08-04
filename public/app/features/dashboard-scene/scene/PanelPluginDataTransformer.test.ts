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
import { SceneDataNode, SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { activateFullSceneTree } from '../utils/test-utils';

import { PanelPluginDataTransformer, wrapInPanelPluginDataTransformer } from './PanelPluginDataTransformer';

const plugins = new Map<string, PanelPlugin>();
/** Plugin ids that must be awaited rather than resolved from the synchronous cache. */
const coldPlugins = new Set<string>();

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => (coldPlugins.has(id) ? undefined : plugins.get(id)),
  importPanelPlugin: (id: string) => {
    const plugin = plugins.get(id);
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
  userTransformations?: SceneDataTransformer['state']['transformations'];
}) {
  const source = new SceneDataNode({
    data: {
      state: LoadingState.Done,
      series: options.series,
      timeRange: getDefaultTimeRange(),
    },
  });

  const pluginTransformer = new PanelPluginDataTransformer({ $data: source, transformations: [] });
  const userTransformer = new SceneDataTransformer({
    $data: pluginTransformer,
    transformations: options.userTransformations ?? [],
  });
  const panel = new VizPanel({ pluginId: options.pluginId, $data: userTransformer });

  return { source, pluginTransformer, userTransformer, panel };
}

/** Field names of the first output frame once the pipeline has settled. */
async function outputFieldNames(userTransformer: SceneDataTransformer) {
  return waitFor(() => {
    const names = userTransformer.state.data?.series[0]?.fields.map((f) => f.name);
    expect(names).toBeDefined();
    return names!;
  });
}

describe('PanelPluginDataTransformer', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  beforeEach(() => {
    plugins.clear();
    coldPlugins.clear();
  });

  it('runs plugin transformations before user transformations', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { userTransformer } = buildPipeline({
      pluginId: 'logs-table',
      series: [frameWithLabels()],
      // Only resolves to a real field ordering if `extractFields` already produced `level`.
      userTransformations: [
        { id: 'organize', options: { indexByName: { level: 0, time: 1, line: 2 }, excludeByName: {} } },
      ],
    });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual([
        'level',
        'time',
        'line',
        'labels',
      ]);
    });
  });

  it('passes data through unchanged when the plugin registers no transformations', async () => {
    registerPlugin('plain');

    const series = [frameWithLabels()];
    const { userTransformer } = buildPipeline({ pluginId: 'plain', series });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.state).toBe(LoadingState.Done);
    });
    // Scenes rebuilds the series array whenever a transformer has any entry, so the array itself
    // is new. What must hold is that the frames pass through untouched, so no extra work lands
    // downstream in structure comparison or field overrides.
    expect(userTransformer.state.data?.series[0] === series[0]).toBe(true);
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
    activateFullSceneTree(matching.userTransformer);

    await waitFor(() => {
      expect(matching.userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    const other = buildPipeline({ pluginId: 'graph', series: [frameWithLabels()] });
    activateFullSceneTree(other.userTransformer);

    await waitFor(() => {
      expect(other.userTransformer.state.data?.state).toBe(LoadingState.Done);
    });
    expect(await outputFieldNames(other.userTransformer)).not.toContain('level');
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

    const { userTransformer } = buildPipeline({ pluginId: 'mixed-topics', series: [frameWithLabels()] });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
    // The series-topic transformation ran while the original fields survived the dropped one.
    expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toEqual([
      'time',
      'line',
      'labels',
      'level',
    ]);
  });

  it('transforms even when the plugin is not yet in the synchronous cache', async () => {
    registerPlugin('cold', (p) => p.setDataTransformations(() => [extractLabels]));
    coldPlugins.add('cold');

    const { userTransformer } = buildPipeline({ pluginId: 'cold', series: [frameWithLabels()] });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
  });

  it('re-runs the supplier when the panel switches visualization', async () => {
    registerPlugin('extracts', (p) => p.setDataTransformations(() => [extractLabels]));
    registerPlugin('plain');

    const { userTransformer, panel } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });

    // No new data arrives on a viz type change, so only the pluginId subscription can drive this.
    panel.setState({ pluginId: 'plain' });

    await waitFor(() => {
      expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).not.toContain('level');
    });
  });

  it('keeps applying plugin transformations after the panel is cloned', async () => {
    registerPlugin('extracts', (p) => p.setDataTransformations(() => [extractLabels]));

    const { panel } = buildPipeline({ pluginId: 'extracts', series: [frameWithLabels()] });
    const clonedPanel = panel.clone();
    const clonedTransformer = clonedPanel.state.$data as SceneDataTransformer;

    expect(clonedTransformer.state.$data).toBeInstanceOf(PanelPluginDataTransformer);
    activateFullSceneTree(clonedTransformer);

    await waitFor(() => {
      expect(clonedTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
    });
  });

  it('surfaces a failing supplier as a panel data error', async () => {
    registerPlugin('broken', (p) =>
      p.setDataTransformations(() => {
        throw new Error('supplier blew up');
      })
    );

    // Scenes logs the failure itself before turning it into panel data.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { userTransformer } = buildPipeline({ pluginId: 'broken', series: [frameWithLabels()] });
    activateFullSceneTree(userTransformer);

    await waitFor(() => {
      expect(userTransformer.state.data?.state).toBe(LoadingState.Error);
    });
    expect(userTransformer.state.data?.errors?.[0].message).toContain('supplier blew up');

    consoleError.mockRestore();
  });

  describe('field overrides', () => {
    it('applies overrides to fields produced by a plugin transformation', async () => {
      registerPlugin('logs-table', (p) => {
        p.setDataTransformations(() => [extractLabels]).useFieldConfig({});
      });

      const { userTransformer, panel } = buildPipeline({ pluginId: 'logs-table', series: [frameWithLabels()] });
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
        expect(userTransformer.state.data?.series[0]?.fields.map((f) => f.name)).toContain('level');
      });

      const withFieldConfig = panel.applyFieldConfig(userTransformer.state.data!);
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

describe('wrapInPanelPluginDataTransformer', () => {
  const queryRunner = () => new SceneQueryRunner({ queries: [{ refId: 'A' }] });

  afterEach(() => {
    setTestFlags({});
  });

  it('returns the provider untouched when the feature toggle is off', () => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });

    const source = queryRunner();
    expect(wrapInPanelPluginDataTransformer(source) === source).toBe(true);
  });

  it('wraps the provider when the feature toggle is on', () => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });

    const source = queryRunner();
    const wrapped = wrapInPanelPluginDataTransformer(source);

    expect(wrapped).toBeInstanceOf(PanelPluginDataTransformer);
    expect((wrapped as PanelPluginDataTransformer).state.$data === source).toBe(true);
  });
});
