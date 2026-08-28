import { cleanup, render, screen } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, type QueryResultMeta, standardTransformersRegistry } from '@grafana/data';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneDataTransformer, SceneObjectRef, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelPluginTransformationsBehaviour } from '../scene/PanelPluginTransformationsBehaviour';
import {
  extractLabels,
  frameWithLabels,
  mockSystemTransformationPlugins,
  registerPlugin,
  systemTransformationPluginImportUtils,
} from '../utils/systemTransformationTestUtils';
import { activateFullSceneTree } from '../utils/test-utils';

import { InspectDataTab } from './InspectDataTab';

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => mockSystemTransformationPlugins.get(id),
  importPanelPlugin: (id: string) => Promise.resolve(mockSystemTransformationPlugins.get(id)),
}));

setPluginImportUtils(systemTransformationPluginImportUtils);

function buildTab(options: {
  pluginId: string;
  userTransformations?: SceneDataTransformer['state']['transformations'];
  seriesMeta?: QueryResultMeta;
}) {
  const series = [frameWithLabels(options.seriesMeta)];

  const transformer = new SceneDataTransformer({
    $data: new SceneDataNode({
      data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
    }),
    transformations: options.userTransformations ?? [],
    $behaviors: [new PanelPluginTransformationsBehaviour()],
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
    mockSystemTransformationPlugins.clear();
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });
  });

  afterEach(() => {
    // Ahead of resetting the flags, which reconfigures the OpenFeature provider: the tab reads a
    // flag through it, and the status update that reaches a still-mounted one lands outside `act`.
    cleanup();
    setTestFlags({});
  });

  it('offers the transformations toggle when the plugin starts transforming after the tab rendered', async () => {
    registerPlugin('plain-table');
    registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

    const { panel, tab } = buildTab({ pluginId: 'plain-table' });
    activateFullSceneTree(panel);

    const { user } = render(<tab.Component model={tab} />);
    await user.click(screen.getByText('Data options'));
    expect(screen.queryByText('Apply panel transformations')).not.toBeInTheDocument();

    // A visualization switch, like a plugin finishing its load, changes what the supplier answers
    // without the query re-running. Only the transformer sees it, so a tab watching the query result
    // alone would go on offering the view it already had.
    panel.setState({ pluginId: 'logs-table' });

    expect(await screen.findByText('Apply panel transformations')).toBeInTheDocument();
  });

  it('offers the transformations toggle when only the plugin registered transformations', async () => {
    registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

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

  it('hides the transformations toggle when the plugin resolves to nothing for these frames', async () => {
    // Registering a supplier installs the wrapper operators whatever the supplier goes on to return,
    // so the pipeline is longer than it looks and only resolving against the frames says whether it
    // does anything.
    registerPlugin('logs-table', (p) => p.setSystemTransformations(() => []));

    const { panel, tab } = buildTab({ pluginId: 'logs-table' });
    activateFullSceneTree(panel);

    expect(await renderAndOpenDataOptions(tab)).not.toBeInTheDocument();
  });

  // A data dependent supplier answers differently for the same panel and plugin, so the toggle can
  // only follow it by resolving per query result.
  const registerBranchingPlugin = () =>
    registerPlugin('logs-table', (p) =>
      p.setSystemTransformations(({ series }) => (series[0]?.meta?.custom?.extract ? [extractLabels] : []))
    );

  it('hides the transformations toggle for frames a data dependent supplier skips', async () => {
    registerBranchingPlugin();

    const { panel, tab } = buildTab({ pluginId: 'logs-table' });
    activateFullSceneTree(panel);

    expect(await renderAndOpenDataOptions(tab)).not.toBeInTheDocument();
  });

  it('offers the transformations toggle for frames a data dependent supplier acts on', async () => {
    registerBranchingPlugin();

    const { panel, tab } = buildTab({ pluginId: 'logs-table', seriesMeta: { custom: { extract: true } } });
    activateFullSceneTree(panel);

    expect(await renderAndOpenDataOptions(tab)).toBeInTheDocument();
  });

  it('hides the transformations toggle when the feature toggle is off', async () => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });
    registerPlugin('logs-table', (p) => p.setSystemTransformations(() => [extractLabels]));

    const { panel, tab } = buildTab({ pluginId: 'logs-table' });
    activateFullSceneTree(panel);

    // The plugin registers transformations but nothing runs them, so offering the toggle would
    // switch between two identical views.
    expect(await renderAndOpenDataOptions(tab)).not.toBeInTheDocument();
  });
});
