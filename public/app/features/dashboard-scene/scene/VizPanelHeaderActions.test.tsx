import { render, screen, waitFor } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { VizPanelHeaderActions } from './VizPanelHeaderActions';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({}),
    getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds-1', type: 'test' }),
  }),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => undefined),
  }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const groupByHeaderActionTestId = selectors.components.Panels.Panel.PanelGroupByHeaderAction;

describe('VizPanelHeaderActions', () => {
  it('renders PanelGroupByAction when the group by variable applies to the panel', async () => {
    const { headerActions, panel } = buildScene();

    const { unmount } = render(<headerActions.Component model={headerActions} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: /group by/i })).toBeInTheDocument());
    expect(screen.queryByTestId(groupByHeaderActionTestId)).toBeInTheDocument();
    expect(panel.state.showMenuAlways).toBe(true);

    unmount();
    expect(panel.state.showMenuAlways).toBe(false);
  });

  it('returns null when applicability is disabled', async () => {
    const { headerActions, panel } = buildScene({ applicabilityEnabled: false });

    render(<headerActions.Component model={headerActions} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: /group by/i })).not.toBeInTheDocument());
    expect(screen.queryByTestId(groupByHeaderActionTestId)).not.toBeInTheDocument();
    expect(panel.state.showMenuAlways).toBeFalsy();
  });

  it('returns null when the datasource uid does not match', async () => {
    const { headerActions, panel } = buildScene({
      variableDatasourceUid: 'other-ds',
    });

    render(<headerActions.Component model={headerActions} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: /group by/i })).not.toBeInTheDocument());
    expect(screen.queryByTestId(groupByHeaderActionTestId)).not.toBeInTheDocument();
    expect(panel.state.showMenuAlways).toBeFalsy();
  });
});

interface BuildSceneOptions {
  applicabilityEnabled?: boolean;
  variableDatasourceUid?: string;
}

function buildScene(options?: BuildSceneOptions) {
  const headerActions = new VizPanelHeaderActions({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'ds-1' },
    queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: [],
    text: [],
    options: [],
    applicabilityEnabled: true,
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
  });

  const dataProvider = new SceneDataTransformer({
    $data: queryRunner,
    transformations: [],
  });

  const panelState: VizPanelState = {
    key: 'panel-1',
    title: 'Panel A',
    pluginId: 'timeseries',
    headerActions,
    $data: dataProvider,
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
  };

  const panel = new VizPanel(panelState);

  new DashboardScene({
    $variables: new SceneVariableSet({
      variables: [groupByVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { headerActions, panel };
}
