import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneVariableSet, CustomVariable, SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VariablesEditView } from './VariablesEditView';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

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
          query: 'test3, test4, $customVar',
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

    it('should change the variable type creating a new variable object', () => {
      const previousVariable = variableView.getVariables()[1] as CustomVariable;
      variableView.onEdit('customVar2');

      variableView.onTypeChange('constant');
      expect(variableView.getVariables()).toHaveLength(2);
      const variable = variableView.getVariables()[1];
      expect(variable).not.toBe(previousVariable);
      expect(variable.state.type).toBe('constant');

      // Values to be kept between the old and new variable
      expect(variable.state.name).toEqual(previousVariable.state.name);
      expect(variable.state.label).toEqual(previousVariable.state.label);
    });

    it('should reset editing variable when going back', () => {
      variableView.onEdit('customVar2');
      expect(variableView.state.editIndex).toBe(1);

      variableView.onGoBack();
      expect(variableView.state.editIndex).toBeUndefined();
    });

    it('should reset editing variable when discarding changes', () => {
      variableView.onEdit('customVar2');
      const editIndex = variableView.state.editIndex!;
      const variable = variableView.getVariables()[editIndex];
      const originalState = { ...variable.state };

      variable.setState({ name: 'newName' });
      variableView.onDiscardChanges();

      const newVariable = variableView.getVariables()[editIndex];
      expect(newVariable.state).toEqual(originalState);
    });

    it('should reset editing variable when discarding changes after the type being changed', () => {
      variableView.onEdit('customVar2');
      const editIndex = variableView.state.editIndex!;
      const variable = variableView.getVariables()[editIndex];
      const originalState = { ...variable.state };

      variableView.onTypeChange('constant');
      variableView.onDiscardChanges();

      const newVariable = variableView.getVariables()[editIndex];
      expect(newVariable.state).toEqual(originalState);
    });

    it('should go back when discarding changes', () => {
      variableView.onEdit('customVar2');
      const editIndex = variableView.state.editIndex!;
      expect(editIndex).toBeDefined();

      variableView.onDiscardChanges();

      expect(variableView.state.editIndex).toBeUndefined();
    });
  });

  describe('Dashboard Variables dependencies', () => {
    let variableView: VariablesEditView;
    let dashboard: DashboardScene;

    beforeEach(async () => {
      const result = await buildTestScene();
      variableView = result.variableView;
      dashboard = result.dashboard;
    });

    // FIXME: This is not working because the variable is replaced or it is not resolved yet
    it.skip('should keep dependencies between variables the type is changed so the variable is replaced', () => {
      // Uses function to avoid store reference to previous existing variables
      const getSourceVariable = () => variableView.getVariables()[0] as CustomVariable;
      const getDependantVariable = () => variableView.getVariables()[1] as CustomVariable;

      expect(getSourceVariable().getValue()).toBe('test');
      // Using getOptionsForSelect to get the interpolated values
      expect(getDependantVariable().getOptionsForSelect()[2].label).toBe('test');

      variableView.onEdit(getSourceVariable().state.name);
      // Simulating changing the type and update the value
      variableView.onTypeChange('constant');
      getSourceVariable().setState({ value: 'newValue' });

      expect(getSourceVariable().getValue()).toBe('newValue');
      expect(getDependantVariable().getOptionsForSelect()[2].label).toBe('newValue');
    });

    it('should keep dependencies with panels when the type is changed so the variable is replaced', async () => {
      // Uses function to avoid store reference to previous existing variables
      const getSourceVariable = () => variableView.getVariables()[0] as CustomVariable;
      const getDependantPanel = () =>
        ((dashboard.state.body as SceneGridLayout).state.children[0] as SceneGridItem).state.body as VizPanel;

      expect(getSourceVariable().getValue()).toBe('test');
      // Using description to get the interpolated value
      expect(getDependantPanel().getDescription()).toContain('Panel A depends on customVar with current value test');

      variableView.onEdit(getSourceVariable().state.name);
      // Simulating changing the type and update the value
      variableView.onTypeChange('constant');
      getSourceVariable().setState({ value: 'newValue' });

      expect(getSourceVariable().getValue()).toBe('newValue');
      expect(getDependantPanel().getDescription()).toContain('newValue');
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
          value: 'test',
          text: 'test',
        }),
        new CustomVariable({
          name: 'customVar2',
          query: 'test3, test4, $customVar',
          value: '$customVar',
          text: '$customVar',
        }),
      ],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          body: new VizPanel({
            title: 'Panel A',
            description: 'Panel A depends on customVar with current value $customVar',
            key: 'panel-1',
            pluginId: 'table',
          }),
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
