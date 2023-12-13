import { SceneVariableSet, CustomVariable, SceneGridItem, SceneGridLayout } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VariablesEditView } from './VariablesEditView';

describe('VariablesEditView', () => {
  describe('Dashboard Variables state', () => {
    let dashboard: DashboardScene;
    let variableView: VariablesEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      variableView = result.variableView;
    });

    it('should return the correct urlKey', () => {
      expect(variableView.getUrlKey()).toBe('variables');
    });

    it('should return the dashboard', () => {
      expect(variableView.getDashboard()).toBe(dashboard);
    });

    it('should return the list of variables', () => {
      const expectedVariables = [
        {
          type: 'custom',
          name: 'customVar',
          query: 'test, test2',
          value: 'test',
        },
        {
          type: 'custom',
          name: 'customVar2',
          query: 'test3, test4',
          value: 'test3',
        },
      ];
      const variables = variableView.getVariables();
      expect(variables).toHaveLength(2);
      expect(variables[0].state).toMatchObject(expectedVariables[0]);
      expect(variables[1].state).toMatchObject(expectedVariables[1]);
    });
  });

  describe('Dashboard Variables actions', () => {
    let variableView: VariablesEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      variableView = result.variableView;
    });

    it('should duplicate a variable', () => {
      const variables = variableView.getVariables();
      const variable = variables[0];
      variableView.onDuplicated(variable.state.name);
      expect(variableView.getVariables()).toHaveLength(3);
      expect(variableView.getVariables()[1].state.name).toBe('copy_of_customVar');
    });

    it('should handle name when duplicating a variable twice', () => {
      const variableIdentifier = 'customVar';
      variableView.onDuplicated(variableIdentifier);
      variableView.onDuplicated(variableIdentifier);
      expect(variableView.getVariables()).toHaveLength(4);
      expect(variableView.getVariables()[1].state.name).toBe('copy_of_customVar_1');
      expect(variableView.getVariables()[2].state.name).toBe('copy_of_customVar');
    });

    it('should delete a variable', () => {
      const variableIdentifier = 'customVar';
      variableView.onDelete(variableIdentifier);
      expect(variableView.getVariables()).toHaveLength(1);
      expect(variableView.getVariables()[0].state.name).toBe('customVar2');
    });

    it('should change order of variables', () => {
      const fromIndex = 0; // customVar is first
      const toIndex = 1;
      variableView.onOrderChanged(fromIndex, toIndex);
      expect(variableView.getVariables()[0].state.name).toBe('customVar2');
      expect(variableView.getVariables()[1].state.name).toBe('customVar');
    });

    it('should keep the same order of variables with invalid indexes', () => {
      const fromIndex = 0;
      const toIndex = 2;

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      variableView.onOrderChanged(fromIndex, toIndex);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(variableView.getVariables()[0].state.name).toBe('customVar');
      expect(variableView.getVariables()[1].state.name).toBe('customVar2');

      errorSpy.mockRestore();
    });
  });
});

async function buildTestScene() {
  const variableView = new VariablesEditView({});
  const dashboard = new DashboardScene({
    title: 'Dashboard with variables',
    uid: 'dash-variables',
    meta: {
      canEdit: true,
    },
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'customVar',
          query: 'test, test2',
        }),
        new CustomVariable({
          name: 'customVar2',
          query: 'test3, test4',
        }),
      ],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: undefined,
        }),
      ],
    }),
    editview: variableView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  variableView.activate();

  return { dashboard, variableView };
}
