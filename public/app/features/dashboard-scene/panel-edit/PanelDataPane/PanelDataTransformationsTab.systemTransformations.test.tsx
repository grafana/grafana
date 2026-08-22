import { render, screen, waitFor } from '@testing-library/react';

import {
  type DataFrame,
  type DataTransformerConfig,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type PanelPlugin,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelDataTransformer } from '../../scene/PanelDataTransformer';
import { activateFullSceneTree } from '../../utils/test-utils';

import { type PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';

const plugins = new Map<string, PanelPlugin>();

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: (id: string) => plugins.get(id),
  importPanelPlugin: (id: string) => Promise.resolve(plugins.get(id)),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(plugins.get(id)!),
  getPanelPluginFromCache: (id: string) => plugins.get(id),
});

/** A frame with a JSON `labels` column, the shape a logs table extracts fields out of. */
const rawData: PanelData = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      name: 'logs',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200] },
        { name: 'labels', type: FieldType.string, values: ['{"level":"info"}', '{"level":"warn"}'] },
      ],
    }),
  ],
};

const extractLabels = {
  id: 'extractFields',
  options: { format: 'json', keepTime: false, replace: false, source: 'labels' },
};

/** Organize fields renders one row per field it is given, so its editor names the input's fields. */
const organize: DataTransformerConfig = { id: 'organize', options: {} };

function createModel(pluginId: string) {
  // Needs a source to activate against; the tab reads the raw frames from the query runner below.
  const transformer = new PanelDataTransformer({
    $data: new SceneDataNode({ data: rawData }),
    transformations: [organize],
  });
  // Activating parents the transformer and is what installs the plugin's transformations — they are
  // only added once a resolved plugin reports that it registers any.
  activateFullSceneTree(new VizPanel({ pluginId, $data: transformer }));

  return {
    getDataTransformer: () => transformer,
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: rawData }),
    onChangeTransformations: jest.fn(),
    // Delegates for real rather than stubbing a result, so these tests exercise the resolver the
    // pipeline uses — including its flag and plugin-identity checks.
    getResolvedSystemTransformations: (series: DataFrame[]) => transformer.getResolvedSystemTransformations(series),
  } as unknown as PanelDataTransformationsTab;
}

describe('PanelDataTransformationsTab system transformations', () => {
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

  it('feeds the editor the fields the plugin transformations produce', async () => {
    const plugin = getPanelPlugin({ id: 'logs-table' });
    plugin.setSystemTransformations(() => [extractLabels]);
    plugins.set('logs-table', plugin);

    render(<PanelDataTransformationsTabRendered model={createModel('logs-table')} />);

    // `level` only exists because the plugin's extractFields ran first. Without it the user's
    // organize transformation is configured against a field set it will never receive.
    await waitFor(() => {
      expect(screen.getByText('level')).toBeInTheDocument();
    });
    expect(screen.getByText('labels')).toBeInTheDocument();
  });

  it('feeds the editor the raw query fields when the plugin registers none', async () => {
    plugins.set('plain-table', getPanelPlugin({ id: 'plain-table' }));

    render(<PanelDataTransformationsTabRendered model={createModel('plain-table')} />);

    await waitFor(() => {
      expect(screen.getByText('labels')).toBeInTheDocument();
    });
    expect(screen.queryByText('level')).not.toBeInTheDocument();
  });
});
