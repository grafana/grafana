import { of } from 'rxjs';

import {
  type DataQueryRequest,
  type DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { CustomVariable, SceneQueryRunner, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { type PanelQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { getVizPanelQueries } from '../serialization/transformSceneToSaveModelSchemaV2';
import { activateFullSceneTree } from '../utils/test-utils';

import { getQueryConditionalRendering, QueryConditionalRenderingBehaviour } from './QueryConditionalRenderingBehaviour';

const grafanaDs = {
  uid: 'grafana',
  type: 'grafana',
  meta: { id: 'grafana' },
  getRef: () => ({ type: 'grafana', uid: 'grafana' }),
};

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (_ds: DataSourceApi, request: DataQueryRequest) =>
    of<PanelData>({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange(), request }),
  getDataSourceSrv: () => ({
    get: async () => grafanaDs,
    getInstanceSettings: () => grafanaDs,
  }),
}));

function panelQuery(refId: string, hidden: boolean, showWhenSelected?: string): PanelQueryKind {
  return {
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden,
      query: { kind: 'DataQuery', group: 'grafana', version: 'v0', spec: {} },
      ...(showWhenSelected
        ? {
            conditionalRendering: {
              kind: 'ConditionalRenderingGroup',
              spec: {
                visibility: 'show',
                condition: 'and',
                items: [
                  {
                    kind: 'ConditionalRenderingVariable',
                    spec: { variable: 'hist_val', operator: 'equals', value: showWhenSelected },
                  },
                ],
              },
            },
          }
        : {}),
    },
  };
}

interface TestScene {
  variable: CustomVariable;
  queryRunner: SceneQueryRunner;
  panel: VizPanel;
  behaviour: QueryConditionalRenderingBehaviour;
}

function buildScene(queries: PanelQueryKind[], selected: string[]): TestScene {
  const variable = new CustomVariable({
    name: 'hist_val',
    query: 'P50,P90,Mean',
    isMulti: true,
    value: selected,
    text: selected,
  });

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'grafana', type: 'grafana' },
    queries: queries.map((query) => ({ refId: query.spec.refId, hide: query.spec.hidden })),
    $behaviors: [QueryConditionalRenderingBehaviour.fromPanelQueries(queries)!],
  });

  const panel = new VizPanel({ title: 'Latency', pluginId: 'timeseries', key: 'panel-1', $data: queryRunner });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  return { variable, queryRunner, panel, behaviour: getQueryConditionalRendering(queryRunner)! };
}

function hiddenRefIds(queryRunner: SceneQueryRunner): string[] {
  return queryRunner.state.queries.filter((query) => query.hide).map((query) => query.refId);
}

describe('QueryConditionalRenderingBehaviour', () => {
  it('gates only the conditional queries and is not created for panels without any', () => {
    const behaviour = QueryConditionalRenderingBehaviour.fromPanelQueries([
      panelQuery('A', false),
      panelQuery('B', false, 'P90'),
    ]);

    expect(behaviour?.state.refIds).toEqual(['B']);
    expect(QueryConditionalRenderingBehaviour.fromPanelQueries([panelQuery('A', false)])).toBeUndefined();
  });

  describe('with the feature flag enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.GrafanaDashboardsQueryConditionalRendering]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    it('hides the queries whose condition is not met on activation', () => {
      const { queryRunner } = buildScene(
        [panelQuery('P50', false, 'P50'), panelQuery('P90', false, 'P90'), panelQuery('Mean', false)],
        ['P50']
      );

      expect(hiddenRefIds(queryRunner)).toEqual(['P90']);
    });

    it('unhides a query and re-runs the panel when its condition becomes met', () => {
      const { variable, queryRunner } = buildScene(
        [panelQuery('P50', false, 'P50'), panelQuery('P90', false, 'P90')],
        ['P50']
      );
      const runQueries = jest.spyOn(queryRunner, 'runQueries');

      variable.changeValueTo(['P50', 'P90']);

      expect(hiddenRefIds(queryRunner)).toEqual([]);
      expect(runQueries).toHaveBeenCalledTimes(1);
    });

    it('does not re-run the panel when no query visibility changes', () => {
      const { variable, queryRunner } = buildScene(
        [panelQuery('P50', false, 'P50'), panelQuery('P90', false, 'P90')],
        ['P50']
      );
      const runQueries = jest.spyOn(queryRunner, 'runQueries');

      variable.changeValueTo(['P50', 'Mean']);

      expect(hiddenRefIds(queryRunner)).toEqual(['P90']);
      expect(runQueries).not.toHaveBeenCalled();
    });

    it('keeps queries hidden by the author hidden whatever their condition', () => {
      const { variable, queryRunner, behaviour } = buildScene([panelQuery('P90', true, 'P90')], ['P50']);

      variable.changeValueTo(['P90']);

      expect(hiddenRefIds(queryRunner)).toEqual(['P90']);
      expect(behaviour.getAuthoredHide(queryRunner.state.queries[0])).toBe(true);
    });

    it('forgets the condition hide of a query unhidden from outside', () => {
      const { queryRunner, behaviour } = buildScene([panelQuery('P90', false, 'P90')], ['P50']);
      expect(behaviour.state.conditionallyHidden).toEqual(['P90']);

      queryRunner.setState({ queries: [{ refId: 'P90', hide: false }] });

      expect(behaviour.state.conditionallyHidden).toEqual([]);
    });

    it('saves the authored hidden state and the conditions', () => {
      const { panel } = buildScene([panelQuery('P50', false, 'P50'), panelQuery('P90', false, 'P90')], ['P50']);

      const v2Queries = getVizPanelQueries(panel);
      expect(v2Queries.map((query) => query.spec.hidden)).toEqual([false, false]);
      expect(v2Queries.map((query) => query.spec.conditionalRendering)).toEqual([
        panelQuery('P50', false, 'P50').spec.conditionalRendering,
        panelQuery('P90', false, 'P90').spec.conditionalRendering,
      ]);

      const v1Targets = vizPanelToPanel(panel).targets ?? [];
      expect(v1Targets.map((target) => target.hide)).toEqual([undefined, undefined]);
    });
  });

  it('does not hide queries whose condition is not met when the feature flag is disabled', () => {
    const { variable, queryRunner, behaviour } = buildScene([panelQuery('P90', false, 'P90')], ['P50']);

    variable.changeValueTo(['Mean']);

    expect(behaviour.getGroup('P90')?.state.result).toBe(false);
    expect(hiddenRefIds(queryRunner)).toEqual([]);
  });
});
