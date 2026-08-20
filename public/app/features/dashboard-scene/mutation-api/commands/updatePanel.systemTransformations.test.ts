import { waitFor } from '@testing-library/react';

import {
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelPlugin,
  getDefaultTimeRange,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, VizPanel, isSystemTransformation } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { type DashboardScene } from '../../scene/DashboardScene';
import { PanelDataTransformer } from '../../scene/PanelDataTransformer';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardMutationClient } from '../DashboardMutationClient';

const plugins = new Map<string, PanelPlugin>();

// The provider's activation handler runs before the panel's own plugin load (activateFullSceneTree
// activates children first), so the synchronous lookup is what has to answer.
jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => plugins.get(id),
  importPanelPlugin: (id: string) => {
    const plugin = plugins.get(id);
    return plugin ? Promise.resolve(plugin) : Promise.reject(new Error(`Plugin ${id} not found`));
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(plugins.get(id)!),
  getPanelPluginFromCache: (id: string) => plugins.get(id),
});

let currentTestScene: unknown;

jest.mock('../../utils/utils', () => {
  const actual = jest.requireActual('../../utils/utils');
  return {
    ...actual,
    getDashboardSceneFor: jest.fn(() => currentTestScene ?? { state: { isEditing: true } }),
  };
});

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

function buildScene(pluginId: string) {
  const transformer = new PanelDataTransformer({
    $data: new SceneDataNode({
      data: {
        state: LoadingState.Done,
        series: [frameWithLabels()],
        timeRange: getDefaultTimeRange(),
      },
    }),
    transformations: [],
  });

  const panel = new VizPanel({ key: 'panel-1', pluginId, title: 'Logs', $data: transformer });
  const body = DefaultGridLayoutManager.fromVizPanels([panel]);
  const state: Record<string, unknown> = { uid: 'test-dash', isEditing: true, body };

  const scene = {
    state,
    serializer: {
      getPanelIdForElement: (name: string) => (name === 'panel-1' ? 1 : undefined),
      getElementIdForPanel: (id: number) => `panel-${id}`,
      getDSReferencesMapping: () => ({ panels: new Map(), variables: new Map(), annotations: new Map() }),
    },
    canEditDashboard: () => true,
    onEnterEditMode: jest.fn(),
    activateSidebar: jest.fn(),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => Object.assign(state, partial)),
  };

  currentTestScene = scene;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { scene: scene as unknown as DashboardScene, panel, transformer };
}

function outputFieldNames(transformer: PanelDataTransformer) {
  return transformer.state.data?.series[0]?.fields.map((f) => f.name);
}

describe('UPDATE_PANEL and plugin registered transformations', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  beforeEach(() => {
    plugins.clear();
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  it('keeps the plugin transformations installed when the command replaces the user ones', async () => {
    const plugin = getPanelPlugin({ id: 'logs-table' });
    plugin.setDataTransformations(() => [extractLabels]);
    plugins.set('logs-table', plugin);

    const { scene, transformer } = buildScene('logs-table');
    activateFullSceneTree(scene.state.body);

    // The plugin's prepended `extractFields` is running before the command lands.
    await waitFor(() => expect(outputFieldNames(transformer)).toContain('level'));
    expect(transformer.state.transformations.filter(isSystemTransformation)).toHaveLength(2);

    const client = new DashboardMutationClient(scene);
    const result = await client.execute({
      type: 'UPDATE_PANEL',
      payload: {
        element: { name: 'panel-1' },
        panel: {
          kind: 'Panel',
          spec: {
            data: {
              kind: 'QueryGroup',
              spec: {
                transformations: [
                  {
                    kind: 'Transformation',
                    group: 'organize',
                    spec: { options: { excludeByName: { labels: true }, indexByName: {}, renameByName: {} } },
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(result.success).toBe(true);

    // The command's own transformation took effect, so this is not a silently skipped update.
    await waitFor(() => expect(outputFieldNames(transformer)).not.toContain('labels'));

    // The command replaces only the user tier, so the plugin's prepend and append wrappers survive.
    expect(transformer.state.transformations.filter(isSystemTransformation)).toHaveLength(2);
    // And they still run: `level` is only ever produced by the plugin's prepended `extractFields`.
    expect(outputFieldNames(transformer)).toContain('level');
  });
});
