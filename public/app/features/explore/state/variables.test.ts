import {
  ConstantVariable,
  CustomVariable,
  QueryVariable,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  TextBoxVariable,
} from '@grafana/scenes';

import { getNextAvailableId, getVariableScene } from '../../dashboard-scene/settings/variables/utils';

import { makeExplorePaneState } from './utils';
import {
  addSceneVariableAction,
  buildExploreVariableScopedVars,
  removeVariableAction,
  replaceVariableAction,
  variablesReducer,
} from './variables';

describe('explore variables state management', () => {
  describe('initial state', () => {
    it('should initialize with an empty SceneVariableSet', () => {
      const state = makeExplorePaneState();
      expect(state.variableSet).toBeInstanceOf(SceneVariableSet);
      expect(state.variableSet.state.variables).toHaveLength(0);
    });
  });

  describe('addSceneVariableAction', () => {
    it('should add a CustomVariable with values', () => {
      const state = makeExplorePaneState();
      const variable = new CustomVariable({ name: 'test', query: 'a,b,c' });

      const newState = variablesReducer(
        state,
        addSceneVariableAction({ exploreId: 'left', variable })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const added = newState.variableSet.state.variables[0];
      expect(added).toBeInstanceOf(CustomVariable);
      expect(added.state.name).toBe('test');
      expect((added as CustomVariable).state.query).toBe('a,b,c');
    });

    it('should add a QueryVariable', () => {
      const state = makeExplorePaneState();
      const variable = new QueryVariable({ name: 'queryVar', query: 'label_values(up, job)' });

      const newState = variablesReducer(
        state,
        addSceneVariableAction({ exploreId: 'left', variable })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const added = newState.variableSet.state.variables[0];
      expect(added).toBeInstanceOf(QueryVariable);
      expect(added.state.name).toBe('queryVar');
    });

    it('should add a TextBoxVariable with a default value', () => {
      const state = makeExplorePaneState();
      const variable = new TextBoxVariable({ name: 'textVar', value: 'myvalue' });

      const newState = variablesReducer(
        state,
        addSceneVariableAction({ exploreId: 'left', variable })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const added = newState.variableSet.state.variables[0];
      expect(added).toBeInstanceOf(TextBoxVariable);
      expect(added.state.name).toBe('textVar');
      expect(String(added.getValue())).toBe('myvalue');
    });

    it('should add a ConstantVariable with a value', () => {
      const state = makeExplorePaneState();
      const variable = new ConstantVariable({ name: 'constVar', value: 'fixed' });

      const newState = variablesReducer(
        state,
        addSceneVariableAction({ exploreId: 'left', variable })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const added = newState.variableSet.state.variables[0];
      expect(added).toBeInstanceOf(ConstantVariable);
      expect(added.state.name).toBe('constVar');
      expect(String(added.getValue())).toBe('fixed');
    });
  });

  describe('auto-generated names', () => {
    it('should generate unique names for the same type', () => {
      const v0 = new QueryVariable({ name: 'query0' });
      const variables = [v0];

      const nextName = getNextAvailableId('query', variables);
      expect(nextName).toBe('query1');
    });

    it('should generate query0 when no query variables exist', () => {
      const nextName = getNextAvailableId('query', []);
      expect(nextName).toBe('query0');
    });

    it('should skip taken names', () => {
      const variables = [
        new CustomVariable({ name: 'custom0' }),
        new CustomVariable({ name: 'custom1' }),
      ];

      const nextName = getNextAvailableId('custom', variables);
      expect(nextName).toBe('custom2');
    });
  });

  describe('removeVariableAction', () => {
    it('should remove a variable by name', () => {
      const variable = new CustomVariable({ name: 'toRemove', query: 'x,y' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [variable] }),
      });

      const newState = variablesReducer(
        state,
        removeVariableAction({ exploreId: 'left', name: 'toRemove' })
      );

      expect(newState.variableSet.state.variables).toHaveLength(0);
    });

    it('should be a no-op when removing a non-existent variable', () => {
      // SceneVariableSet re-parenting warning is expected when variables are moved to a new set
      jest.spyOn(console, 'warn').mockImplementation();

      const variable = new CustomVariable({ name: 'existing', query: 'a' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [variable] }),
      });

      const newState = variablesReducer(
        state,
        removeVariableAction({ exploreId: 'left', name: 'nonExistent' })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      expect(newState.variableSet.state.variables[0].state.name).toBe('existing');
    });
  });

  describe('replaceVariableAction', () => {
    it('should replace a variable by name preserving name and label', () => {
      const original = new CustomVariable({ name: 'myVar', label: 'My Variable', query: 'a,b' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [original] }),
      });

      const replacement = getVariableScene('textbox', { name: 'myVar', label: 'My Variable' });

      const newState = variablesReducer(
        state,
        replaceVariableAction({ exploreId: 'left', oldName: 'myVar', variable: replacement })
      );

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const replaced = newState.variableSet.state.variables[0];
      expect(replaced).toBeInstanceOf(TextBoxVariable);
      expect(replaced.state.name).toBe('myVar');
      expect(replaced.state.label).toBe('My Variable');
    });
  });

  describe('buildExploreVariableScopedVars', () => {
    it('should convert empty SceneVariableSet to empty ScopedVars', () => {
      const variableSet = new SceneVariableSet({ variables: [] });
      const scopedVars = buildExploreVariableScopedVars(variableSet);
      expect(scopedVars).toEqual({});
    });

    it('should convert a CustomVariable to correct ScopedVars format', () => {
      const variable = new CustomVariable({ name: 'job', query: 'demo,node', value: 'demo', text: 'demo' });
      const variableSet = new SceneVariableSet({ variables: [variable] });

      const scopedVars = buildExploreVariableScopedVars(variableSet);

      expect(scopedVars).toHaveProperty('job');
      expect(scopedVars['job']).toEqual({ text: 'demo', value: 'demo' });
    });

    it('should convert multiple variables to multiple ScopedVars entries', () => {
      const v1 = new CustomVariable({ name: 'job', query: 'demo,node', value: 'demo', text: 'demo' });
      const v2 = new TextBoxVariable({ name: 'filter', value: 'error' });
      const v3 = new ConstantVariable({ name: 'env', value: 'prod' });
      const variableSet = new SceneVariableSet({ variables: [v1, v2, v3] });

      const scopedVars = buildExploreVariableScopedVars(variableSet);

      expect(Object.keys(scopedVars)).toHaveLength(3);
      expect(scopedVars['job']).toEqual({ text: 'demo', value: 'demo' });
      expect(scopedVars['filter']).toEqual(
        expect.objectContaining({ value: 'error' })
      );
      expect(scopedVars['env']).toEqual(
        expect.objectContaining({ value: 'prod' })
      );
    });
  });

  describe('SceneVariableValueChangedEvent', () => {
    it('should fire when a variable value changes', () => {
      const variable = new CustomVariable({ name: 'job', query: 'a,b', value: 'a', text: 'a' });
      const variableSet = new SceneVariableSet({ variables: [variable] });
      variableSet.activate();

      const handler = jest.fn();
      variableSet.subscribeToEvent(SceneVariableValueChangedEvent, handler);

      variable.changeValueTo('b', 'b');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
