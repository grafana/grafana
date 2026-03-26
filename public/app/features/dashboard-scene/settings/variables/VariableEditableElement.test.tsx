import { CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { VariableEditableElement } from './VariableEditableElement';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    variableActionButtonClicked: jest.fn(),
  },
}));

const variableActionButtonClickedMock = jest.mocked(DashboardInteractions.variableActionButtonClicked);

function buildTestVariables() {
  const var1 = new CustomVariable({ name: 'query0', query: 'a, b, c' });
  const var2 = new CustomVariable({ name: 'query1', query: 'd, e, f' });
  const set = new SceneVariableSet({ variables: [var1, var2] });
  return { var1, var2, set };
}

function buildTestScene($variables: SceneVariableSet) {
  const dashboard = new DashboardScene({ $variables });
  activateFullSceneTree(dashboard);
  return dashboard;
}

describe('VariableEditableElement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onDuplicate', () => {
    describe('when the variable is in a SceneVariableSet', () => {
      test('adds a clone and tracks the interaction', () => {
        const { var1, set } = buildTestVariables();
        buildTestScene(set);

        const element = new VariableEditableElement(var1);
        element.onDuplicate();

        expect(set.state.variables).toHaveLength(3);

        const cloned = set.state.variables[2] as CustomVariable;
        expect(cloned).toBeInstanceOf(CustomVariable);

        expect(cloned).not.toBe(var1);
        expect(cloned.state.key).not.toBe(var1.state.key);

        expect(cloned.state.name).toBe(var1.state.name);
        expect(cloned.state.query).toBe(var1.state.query);

        expect(variableActionButtonClickedMock).toHaveBeenCalledWith('duplicate', { type: 'custom' });
      });
    });

    describe('when the variable is not in a SceneVariableSet', () => {
      test('does nothing', () => {
        const element = new VariableEditableElement(new CustomVariable({ name: 'orphan', query: 'x' }));

        element.onDuplicate();

        expect(variableActionButtonClickedMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('onDelete', () => {
    describe('when the variable is in a SceneVariableSet', () => {
      test('removes it and tracks the interaction', () => {
        const { var1, var2, set } = buildTestVariables();
        buildTestScene(set);

        const element = new VariableEditableElement(var1);
        element.onDelete();

        expect(set.state.variables).toHaveLength(1);
        expect(set.state.variables[0]).toBe(var2);

        expect(DashboardInteractions.variableActionButtonClicked).toHaveBeenCalledWith('delete', { type: 'custom' });
      });
    });

    describe('when the variable is not in a SceneVariableSet', () => {
      test('does nothing', () => {
        const element = new VariableEditableElement(new CustomVariable({ name: 'orphan', query: 'x' }));

        element.onDelete();

        expect(DashboardInteractions.variableActionButtonClicked).not.toHaveBeenCalled();
      });
    });
  });
});
