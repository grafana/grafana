import { render, screen } from 'test/test-utils';

import {
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelPlugin,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneObjectRef, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataTransformer } from '../scene/PanelDataTransformer';
import { activateFullSceneTree } from '../utils/test-utils';

import { InspectDataTab } from './InspectDataTab';

const plugins = new Map<string, PanelPlugin>();

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => plugins.get(id),
  importPanelPlugin: (id: string) => Promise.resolve(plugins.get(id)),
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

const extractLabels = {
  id: 'extractFields',
  options: { format: 'json', keepTime: false, replace: false, source: 'labels' },
};

function buildTab(options: {
  pluginId: string;
  userTransformations?: PanelDataTransformer['state']['transformations'];
}) {
  const series = [
    toDataFrame({
      name: 'logs',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200] },
        { name: 'labels', type: FieldType.string, values: ['{"level":"info"}', '{"level":"warn"}'] },
      ],
    }),
  ];

  const transformer = new PanelDataTransformer({
    $data: new SceneDataNode({
      data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
    }),
    transformations: options.userTransformations ?? [],
  });

  const panel = new VizPanel({
    pluginId: options.pluginId,
    title: 'Logs',
    $data: transformer,
    $timeRange: new SceneTimeRange({}),
  });

  const tab = new InspectDataTab({ panelRef: new SceneObjectRef(panel) });

  return { panel, transformer, tab };
}

/**
 * Renders the tab and expands the collapsed "Data options" row the toggles live in, returning the
 * field that flips the tab between the query result and the frames the panel renders. Matched on
 * its label rather than its role: `Field` does not wire an accessible name onto `Switch`.
 */
async function renderAndOpenDataOptions(tab: InspectDataTab) {
  const { user } = render(<tab.Component model={tab} />);

  await user.click(screen.getByText('Data options'));

  return screen.queryByText('Apply panel transformations');
}

describe('InspectDataTab', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  beforeEach(() => {
    plugins.clear();
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('offers the transformations toggle when only the plugin registered transformations', async () => {
    registerPlugin('logs-table', (p) => p.setDataTransformations(() => [extractLabels]));

    const { panel, tab } = buildTab({ pluginId: 'logs-table' });
    activateFullSceneTree(panel);

    // Without it the tab shows the query result with no way to reach the frames the panel drew.
    expect(await renderAndOpenDataOptions(tab)).toBeInTheDocument();
  });

  it('offers the transformations toggle for user transformations', async () => {
    registerPlugin('logs-table');

    const { panel, tab } = buildTab({
      pluginId: 'logs-table',
      userTransformations: [{ id: 'organize', options: {} }],
    });
    activateFullSceneTree(panel);

    expect(await renderAndOpenDataOptions(tab)).toBeInTheDocument();
  });

  it('hides the transformations toggle when nothing transforms the data', async () => {
    registerPlugin('logs-table');

    const { panel, tab } = buildTab({ pluginId: 'logs-table' });
    activateFullSceneTree(panel);

    expect(await renderAndOpenDataOptions(tab)).not.toBeInTheDocument();
  });
});
