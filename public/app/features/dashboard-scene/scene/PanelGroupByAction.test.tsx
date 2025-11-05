import { of } from 'rxjs';

import { DataQueryRequest, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { GroupByVariable, SceneQueryRunner, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { PanelGroupByAction } from './PanelGroupByAction';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => undefined),
  }),
}));

describe('PanelGroupByAction', () => {
  describe('Initialization', () => {
    it('should create PanelGroupByAction instance', () => {
      const action = new PanelGroupByAction();
      expect(action).toBeDefined();
      expect(action).toBeInstanceOf(PanelGroupByAction);
    });

    it('should find GroupByVariable after activation', () => {
      const { action, variable } = buildTestScene();

      // Mock validateAndUpdate to avoid hanging
      jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(
        of({
          origin: variable,
          state: variable.state,
        })
      );

      const deactivate = action.activate();

      const groupByVar = action.getGroupByVariable();
      expect(groupByVar).toBeDefined();
      expect(groupByVar).toBeInstanceOf(GroupByVariable);
      expect(groupByVar?.state.name).toBe('A');

      deactivate();
    });

    it('should return options array', async () => {
      const { action, variable } = buildTestScene();

      jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(
        of({
          origin: variable,
          state: {
            ...variable.state,
            options: [
              { label: 'field1', value: 'field1' },
              { label: 'field2', value: 'field2' },
            ],
          },
        })
      );

      jest.spyOn(variable, 'getGroupByApplicabilityForQueries').mockResolvedValue([
        { key: 'field1', applicable: true },
        { key: 'field2', applicable: true },
      ]);

      const deactivate = action.activate();

      const options = await action.getGroupByOptions();
      expect(Array.isArray(options)).toBe(true);

      deactivate();
    });
  });

  describe('GroupBy variable integration', () => {
    it('should access variable through scene graph', () => {
      const { action, variable } = buildTestScene();

      jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(
        of({
          origin: variable,
          state: variable.state,
        })
      );

      const deactivate = action.activate();

      const foundVariable = action.getGroupByVariable();
      expect(foundVariable).toBe(variable);
      expect(foundVariable?.state.type).toBe('groupby');

      deactivate();
    });

    it('should handle missing GroupByVariable gracefully', () => {
      const action = new PanelGroupByAction();
      const panel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        headerActions: [action],
        $data: new SceneQueryRunner({
          datasource: { uid: 'my-uid' },
          queries: [{ query: 'QueryA', refId: 'A' }],
        }),
      });

      new DashboardScene({
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [], // No GroupByVariable
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const deactivate = action.activate();

      expect(action.getGroupByVariable()).toBeUndefined();

      deactivate();
    });
  });

  describe('Panel parent requirement', () => {
    it('should throw error if parent is not VizPanel', () => {
      const action = new PanelGroupByAction();

      expect(() => {
        action.activate();
      }).toThrow('PanelGroupByAction can be used only for VizPanel');
    });
  });

  describe('getGroupByOptions', () => {
    it('should return empty array when variable has no options', async () => {
      const { action, variable } = buildTestScene();

      jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(
        of({
          origin: variable,
          state: {
            ...variable.state,
            options: [],
          },
        })
      );

      const deactivate = action.activate();

      const options = await action.getGroupByOptions();
      expect(options).toEqual([]);

      deactivate();
    });

    it('should filter options based on applicability', async () => {
      const { action, variable, panel } = buildTestScene();

      variable.setState({
        options: [
          { label: 'field1', value: 'field1' },
          { label: 'field2', value: 'field2' },
          { label: 'field3', value: 'field3' },
        ],
      });

      const queryRunner = panel.state.$data as SceneQueryRunner;
      queryRunner.setState({
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
          request: {
            targets: [{ refId: 'A', datasource: { uid: 'test-uid', type: 'prometheus' } }],
          } as DataQueryRequest,
        },
      });

      jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(
        of({
          origin: variable,
          state: variable.state,
        })
      );

      jest.spyOn(variable, 'getGroupByApplicabilityForQueries').mockResolvedValue([
        { key: 'field1', applicable: true },
        { key: 'field2', applicable: false },
        { key: 'field3', applicable: true },
      ]);

      const deactivate = action.activate();

      const options = await action.getGroupByOptions();
      expect(options).toHaveLength(2);
      expect(options).toEqual([
        { label: 'field1', value: 'field1' },
        { label: 'field3', value: 'field3' },
      ]);

      deactivate();
    });
  });
});

function buildTestScene() {
  const variable = new GroupByVariable({
    name: 'A',
    label: 'A',
    description: 'A',
    type: 'groupby',
    value: 'Text',
  });

  const action = new PanelGroupByAction();

  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    headerActions: [action],
    $data: new SceneQueryRunner({
      datasource: { uid: 'my-uid' },
      queries: [{ query: 'QueryA', refId: 'A' }],
    }),
  });

  const dashboard = new DashboardScene({
    uid: 'A',
    $variables: new SceneVariableSet({
      variables: [variable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { action, panel, dashboard, variable };
}
