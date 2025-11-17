import { render, screen, waitFor } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { VizPanelSubHeader } from './VizPanelSubHeader';
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

const subHeaderTestId = selectors.components.Panels.Panel.PanelNonApplicableDrilldownsSubHeader;

describe('VizPanelSubHeader', () => {
  it('renders when the group by variable applies to the panel', async () => {
    const subHeader = buildScene();

    render(<subHeader.Component model={subHeader} />);

    await waitFor(() => expect(screen.queryByTestId(subHeaderTestId)).toBeInTheDocument());
  });

  it('renders when the adhoc variable applies to the panel', async () => {
    const subHeader = buildScene();

    render(<subHeader.Component model={subHeader} />);

    await waitFor(() => expect(screen.queryByTestId(subHeaderTestId)).toBeInTheDocument());
  });

  it('returns null when applicability is disabled', async () => {
    const subHeader = buildScene({ applicabilityEnabled: false });

    render(<subHeader.Component model={subHeader} />);

    await waitFor(() => expect(screen.queryByTestId(subHeaderTestId)).not.toBeInTheDocument());
  });

  it('returns null when the datasource uid does not match', async () => {
    const subHeader = buildScene({
      variableDatasourceUid: 'other-ds',
    });

    render(<subHeader.Component model={subHeader} />);

    await waitFor(() => expect(screen.queryByTestId(subHeaderTestId)).not.toBeInTheDocument());
  });
});

interface BuildSceneOptions {
  applicabilityEnabled?: boolean;
  variableDatasourceUid?: string;
}

function buildScene(options?: BuildSceneOptions) {
  const subHeader = new VizPanelSubHeader({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'ds-1' },
    queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
  });

  const adhocFiltersVariable = new AdHocFiltersVariable({
    name: 'adhoc',
    label: 'adhoc',
    filters: [{ key: 'filter-1', operator: '=', value: 'value-1' }],
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: ['groupBy'],
    text: ['groupBy'],
    options: [],
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
  });

  const applicabilityEnabled = options?.applicabilityEnabled ?? true;
  (groupByVariable as GroupByVariable).isApplicabilityEnabled = jest.fn(() => applicabilityEnabled);
  (adhocFiltersVariable as AdHocFiltersVariable).isApplicabilityEnabled = jest.fn(() => applicabilityEnabled);

  const dataProvider = new SceneDataTransformer({
    $data: queryRunner,
    transformations: [],
  });

  const panelState: VizPanelState = {
    key: 'panel-1',
    title: 'Panel A',
    pluginId: 'timeseries',
    subHeader,
    $data: dataProvider,
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
  };

  const panel = new VizPanel(panelState);

  new DashboardScene({
    $variables: new SceneVariableSet({
      variables: [groupByVariable, adhocFiltersVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return subHeader;
}
