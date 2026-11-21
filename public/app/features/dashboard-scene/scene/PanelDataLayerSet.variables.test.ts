import { waitFor } from '@testing-library/react';
import { advanceTo, clear } from 'jest-date-mock';
import { of } from 'rxjs';
import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import {
  type DataSourceFallbackWatcher,
  seedDataSources,
  watchDataSourceFallbacks,
} from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import {
  type AnnotationQuery,
  type DataQuery,
  type DataQueryRequest,
  type DataSourceApi,
  LoadingState,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { getTemplateSrv, setPluginImportUtils, setTemplateSrv } from '@grafana/runtime';
import {
  LocalValueVariable,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VizPanel,
} from '@grafana/scenes';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { serializeSectionAnnotations } from '../serialization/layoutSerializers/sectionAnnotations';
import { cloneSectionDataLayerSet } from '../utils/clone';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet, PanelDataLayerSet } from './DashboardDataLayerSet';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { PanelTimeRange } from './panel-timerange/PanelTimeRange';

interface AnnotationTestQuery extends DataQuery {
  expression: string;
}

const templateSrv = new TemplateSrv();
const runRequest = jest.fn((ds: DataSourceApi, request: DataQueryRequest<AnnotationTestQuery>) =>
  of({
    state: LoadingState.Done,
    timeRange: request.range,
    series: [
      toDataFrame([
        {
          time: Date.parse('2019-02-08T20:00:00Z'),
          text: templateSrv.replace(request.targets[0].expression, request.scopedVars),
        },
      ]),
    ],
  })
);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => runRequest,
}));

describe('panel annotation variable scopes', () => {
  let deactivate: () => void;
  let dataSourceFallbacks: DataSourceFallbackWatcher;
  let previousTemplateSrv: ReturnType<typeof getTemplateSrv>;

  beforeAll(() => {
    const plugin = getPanelPlugin({});
    setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });
  });

  beforeEach(() => {
    advanceTo(new Date('2019-02-11T19:00:00Z'));
    jest.clearAllMocks();
    previousTemplateSrv = getTemplateSrv();
    setTemplateSrv(templateSrv);
    seedDataSources(
      ['dashboard', 'tab', 'row', 'panel', 'dashboard-updated', 'tab-updated', 'row-updated', 'panel-updated'].map(
        (env) => {
          const settings = makeDataSourceSettings(`${env}-ds`, `${env}-ds`, 'test');
          const api = new MockDataSourceApi(settings, undefined, settings.meta);
          api.annotations = { prepareQuery: (annotation) => annotation.target };
          return { settings, api };
        }
      ),
      { legacySrv: 'none' }
    );
    dataSourceFallbacks = watchDataSourceFallbacks();
  });

  afterEach(() => {
    deactivate?.();
    clear();
    setTemplateSrv(previousTemplateSrv);
    dataSourceFallbacks.expectNoFallbacks(['instance', 'settings', 'list']);
  });

  function setup() {
    const dashboardVariable = new TextBoxVariable({ name: 'env', value: 'dashboard' });
    const tabVariable = new TextBoxVariable({ name: 'env', value: 'tab' });
    const rowVariable = new TextBoxVariable({ name: 'env', value: 'row' });
    const panelVariable = new TextBoxVariable({ name: 'env', value: 'panel' });
    const runner = new SceneQueryRunner({ queries: [], runQueriesMode: 'manual', $data: new PanelDataLayerSet() });
    const panel = new VizPanel({
      pluginId: 'timeseries',
      $data: runner,
      $timeRange: new PanelTimeRange({ timeFrom: '72h' }),
      $variables: new SceneVariableSet({
        variables: [panelVariable, new LocalValueVariable({ name: 'onlyPanel', value: 'repeat-value' })],
      }),
    });
    const row = new RowItem({
      title: 'Row',
      $variables: new SceneVariableSet({ variables: [rowVariable] }),
      $data: annotationSet('row'),
      layout: new AutoGridLayoutManager({
        layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }),
      }),
    });
    const tab = new TabItem({
      title: 'Tab',
      $variables: new SceneVariableSet({ variables: [tabVariable] }),
      $data: annotationSet('tab'),
      layout: new RowsLayoutManager({ rows: [row] }),
    });
    const tabs = new TabsLayoutManager({ tabs: [tab] });
    tabs.setState({ currentTabSlug: tab.getSlug() });
    const dashboardLayers = annotationSet('dashboard');
    const scene = new SceneFlexLayout({
      $timeRange: new SceneTimeRange({ from: 'now-2d', to: 'now' }),
      $variables: new SceneVariableSet({ variables: [dashboardVariable] }),
      $data: dashboardLayers,
      children: [new SceneFlexItem({ body: tabs })],
    });
    deactivate = activateFullSceneTree(scene);
    return { dashboardVariable, tabVariable, rowVariable, panelVariable, runner, dashboardLayers };
  }

  it('uses each annotation definition scope for query text and datasource variables, with the panel time macros', async () => {
    const { runner } = setup();

    await waitFor(() => {
      expect(annotationTexts(runner)?.sort()).toEqual([
        'dashboard|$onlyPanel|1549652400000|1549911600000',
        'row|$onlyPanel|1549652400000|1549911600000',
        'tab|$onlyPanel|1549652400000|1549911600000',
      ]);
    });
    expect([...new Set(panelRequests().map(([ds]) => ds.uid))].sort()).toEqual(['dashboard-ds', 'row-ds', 'tab-ds']);
    expect([...new Set(panelRequests().map(([, request]) => request.range.from.toISOString()))]).toEqual([
      '2019-02-08T19:00:00.000Z',
    ]);
  });

  it('requeries the original variable dependencies even when deeper scopes shadow their names', async () => {
    const { dashboardVariable, tabVariable, rowVariable, panelVariable, runner } = setup();
    await waitFor(() => expect(annotationTexts(runner)).toHaveLength(3));
    runRequest.mockClear();

    dashboardVariable.setValue('dashboard-updated');
    await waitFor(() => {
      expect(annotationTexts(runner)).toContain('dashboard-updated|$onlyPanel|1549652400000|1549911600000');
    });
    expect(panelRequests().map(([ds]) => ds.uid)).toEqual(['dashboard-updated-ds']);
    runRequest.mockClear();

    panelVariable.setValue('panel-updated');
    rowVariable.setValue('row-updated');
    await waitFor(() => {
      expect(annotationTexts(runner)).toContain('row-updated|$onlyPanel|1549652400000|1549911600000');
    });
    expect(panelRequests().map(([ds]) => ds.uid)).toEqual(['row-updated-ds']);
    runRequest.mockClear();

    tabVariable.setValue('tab-updated');
    await waitFor(() => {
      expect(annotationTexts(runner)).toContain('tab-updated|$onlyPanel|1549652400000|1549911600000');
    });
    expect(panelRequests().map(([ds]) => ds.uid)).toEqual(['tab-updated-ds']);
  });

  it('does not save or clone runtime copies and releases them when the panel is deactivated', async () => {
    const { dashboardLayers, runner } = setup();
    await waitFor(() => expect(annotationTexts(runner)).toContain('dashboard|$onlyPanel|1549652400000|1549911600000'));

    expect(dashboardLayers.state.panelLayers.map((layer) => layer.state.$timeRange?.state.value.raw)).toEqual([
      { from: 'now-72h', to: 'now' },
    ]);
    expect(dashboardLayers.state.panelLayers[0].state.$timeRange?.urlSync).toBeUndefined();
    expect(serializeSectionAnnotations(dashboardLayers)?.map((annotation) => annotation.spec.name)).toEqual([
      'dashboard',
    ]);
    const cloned = cloneSectionDataLayerSet(dashboardLayers)!;
    expect(cloned.state.annotationLayers.map((layer) => layer.state.name)).toEqual(['dashboard']);
    expect(cloned.state.panelLayers).toEqual([]);

    deactivate();
    deactivate = () => {};
    expect(dashboardLayers.state.panelLayers).toEqual([]);
  });
});

function annotationSet(name: string) {
  const query: AnnotationQuery<AnnotationTestQuery> = {
    name,
    enable: true,
    iconColor: 'red',
    datasource: { uid: '${env}-ds', type: 'test' },
    target: { refId: 'Anno', expression: '$env|$onlyPanel|$__from|$__to' },
  };
  return new DashboardDataLayerSet({
    annotationLayers: [
      new DashboardAnnotationsDataLayer({
        name,
        query,
      }),
    ],
  });
}

function annotationTexts(runner: SceneQueryRunner) {
  return runner.state.data?.annotations?.flatMap(
    (frame) => frame.fields.find((field) => field.name === 'text')?.values ?? []
  );
}

function panelRequests() {
  return runRequest.mock.calls.filter(([, request]) => request.range.raw.from === 'now-72h');
}
