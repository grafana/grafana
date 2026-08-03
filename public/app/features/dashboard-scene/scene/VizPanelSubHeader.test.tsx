import { of } from 'rxjs';

import { type DataQueryRequest, type DataSourceApi, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  type VizPanelState,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { PanelPluginDataTransformer } from './PanelPluginDataTransformer';
import { VizPanelSubHeader } from './VizPanelSubHeader';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({
      getRef: () => ({ uid: 'ds-1', type: 'test' }),
    }),
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

describe('VizPanelSubHeader', () => {
  it('renders when the drilldown variables apply to the panel', async () => {
    const { subHeader } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('renders only one drilldown var is set', async () => {
    const { subHeader } = await buildScene({ noGroupBy: true });

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('does not render when applicability is disabled', async () => {
    const { subHeader } = await buildScene({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('does not render when the datasource uid does not match', async () => {
    const { subHeader } = await buildScene({
      variableDatasourceUid: 'other-ds',
    });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('no longer renders if variable ds changes to a different type', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene({
      noGroupBy: true,
    });

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ datasource: { uid: 'ds-2' } });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('no longers renders if variable applicability becomes disabled', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene({
      noGroupBy: true,
    });

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('continues to render if one adhoc is disabled, but groupby remains active', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('stops rendering if queryRunner changes datasource to different one than vars', async () => {
    const { subHeader, queryRunner } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);

    queryRunner.setState({ datasource: { uid: 'ds-2' } });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  describe('getQueryRunner', () => {
    it('finds the query runner directly under the user transformer', async () => {
      const { subHeader, queryRunner } = await buildScene();

      const found = subHeader.getQueryRunner();

      expect(found).toBeInstanceOf(SceneQueryRunner);
      // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
      // diff cannot be serialized by the jest reporter.
      expect(found === queryRunner).toBe(true);
    });

    it('finds the query runner through a nested panel-plugin transformer', async () => {
      const { subHeader, queryRunner } = await buildScene({ withPluginTransformer: true });

      // Unwrapping a single level of `$data` lands on the plugin transformer and would silently
      // return null here, hiding the non-applicable drilldowns sub header.
      const found = subHeader.getQueryRunner();

      expect(found).toBeInstanceOf(SceneQueryRunner);
      // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
      // diff cannot be serialized by the jest reporter.
      expect(found === queryRunner).toBe(true);
    });
  });
});

interface BuildSceneOptions {
  applicabilityEnabled?: boolean;
  variableDatasourceUid?: string;
  noGroupBy?: boolean;
  /** Nest a panel-plugin transformer between the query runner and the user's transformer. */
  withPluginTransformer?: boolean;
}

async function buildScene(options?: BuildSceneOptions) {
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
    applicabilityEnabled: options?.applicabilityEnabled ?? true,
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: ['groupBy'],
    text: ['groupBy'],
    options: [],
    applicabilityEnabled: options?.applicabilityEnabled ?? true,
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
  });

  const dataProvider = new SceneDataTransformer({
    $data: options?.withPluginTransformer
      ? new PanelPluginDataTransformer({ $data: queryRunner, transformations: [] })
      : queryRunner,
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

  const scene = new DashboardScene({
    $variables: new SceneVariableSet({
      variables: options?.noGroupBy ? [adhocFiltersVariable] : [groupByVariable, adhocFiltersVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { subHeader, groupByVariable, adhocFiltersVariable, queryRunner };
}
