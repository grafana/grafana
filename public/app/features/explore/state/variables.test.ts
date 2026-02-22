import { CustomVariable, SceneVariableSet, SceneVariableValueChangedEvent } from '@grafana/scenes';

import { getNextAvailableId } from '../../dashboard-scene/settings/variables/utils';

import { makeExplorePaneState } from './utils';
import {
  addSceneVariableAction,
  buildExploreVariableScopedVars,
  removeVariableAction,
  setVariablesAction,
  variablesReducer,
} from './variables';
import { deserializeVariables, serializeVariableSet } from './variablesSerialization';

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

      const newState = variablesReducer(state, addSceneVariableAction({ exploreId: 'left', variable }));

      expect(newState.variableSet.state.variables).toHaveLength(1);
      const added = newState.variableSet.state.variables[0];
      expect(added).toBeInstanceOf(CustomVariable);
      expect(added.state.name).toBe('test');
      expect((added as CustomVariable).state.query).toBe('a,b,c');
    });
  });

  describe('auto-generated names', () => {
    it('should generate unique names for the same type', () => {
      const v0 = new CustomVariable({ name: 'custom0' });
      const variables = [v0];

      const nextName = getNextAvailableId('custom', variables);
      expect(nextName).toBe('custom1');
    });

    it('should generate custom0 when no custom variables exist', () => {
      const nextName = getNextAvailableId('custom', []);
      expect(nextName).toBe('custom0');
    });

    it('should skip taken names', () => {
      const variables = [new CustomVariable({ name: 'custom0' }), new CustomVariable({ name: 'custom1' })];

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

      const newState = variablesReducer(state, removeVariableAction({ exploreId: 'left', name: 'toRemove' }));

      expect(newState.variableSet.state.variables).toHaveLength(0);
    });

    it('should be a no-op when removing a non-existent variable', () => {
      // SceneVariableSet re-parenting warning is expected when variables are moved to a new set
      jest.spyOn(console, 'warn').mockImplementation();

      const variable = new CustomVariable({ name: 'existing', query: 'a' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [variable] }),
      });

      const newState = variablesReducer(state, removeVariableAction({ exploreId: 'left', name: 'nonExistent' }));

      expect(newState.variableSet.state.variables).toHaveLength(1);
      expect(newState.variableSet.state.variables[0].state.name).toBe('existing');
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
      const v2 = new CustomVariable({ name: 'env', query: 'dev,prod', value: 'dev', text: 'dev' });
      const v3 = new CustomVariable({ name: 'region', query: 'us,eu', value: 'us', text: 'us' });
      const variableSet = new SceneVariableSet({ variables: [v1, v2, v3] });

      const scopedVars = buildExploreVariableScopedVars(variableSet);

      expect(Object.keys(scopedVars)).toHaveLength(3);
      expect(scopedVars['job']).toEqual({ text: 'demo', value: 'demo' });
      expect(scopedVars['env']).toEqual({ text: 'dev', value: 'dev' });
      expect(scopedVars['region']).toEqual({ text: 'us', value: 'us' });
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

  describe('setVariablesAction', () => {
    it('should replace the entire variable set', () => {
      const v1 = new CustomVariable({ name: 'old', query: 'x' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [v1] }),
      });

      const newVars = [
        new CustomVariable({ name: 'new1', query: 'a,b' }),
        new CustomVariable({ name: 'new2', query: 'c,d' }),
      ];

      const newState = variablesReducer(state, setVariablesAction({ exploreId: 'left', variables: newVars }));

      expect(newState.variableSet.state.variables).toHaveLength(2);
      expect(newState.variableSet.state.variables[0].state.name).toBe('new1');
      expect(newState.variableSet.state.variables[1].state.name).toBe('new2');
    });

    it('should set an empty variable set', () => {
      const v1 = new CustomVariable({ name: 'old', query: 'x' });
      const state = makeExplorePaneState({
        variableSet: new SceneVariableSet({ variables: [v1] }),
      });

      const newState = variablesReducer(state, setVariablesAction({ exploreId: 'left', variables: [] }));

      expect(newState.variableSet.state.variables).toHaveLength(0);
    });
  });

  describe('serializeVariableSet', () => {
    it('should return undefined for an empty set', () => {
      const set = new SceneVariableSet({ variables: [] });
      expect(serializeVariableSet(set)).toBeUndefined();
    });

    it('should serialize a CustomVariable with basic fields', () => {
      const v = new CustomVariable({ name: 'job', query: 'demo,node', value: 'demo', text: 'demo' });
      const set = new SceneVariableSet({ variables: [v] });
      const result = serializeVariableSet(set);

      expect(result).toEqual([
        {
          name: 'job',
          query: 'demo,node',
          value: 'demo',
          text: 'demo',
        },
      ]);
    });

    it('should serialize optional fields when set', () => {
      const v = new CustomVariable({
        name: 'env',
        label: 'Environment',
        description: 'Select environment',
        query: 'dev,staging,prod',
        isMulti: true,
        includeAll: true,
        allValue: '*',
        allowCustomValue: true,
        value: ['dev', 'staging'],
        text: ['dev', 'staging'],
      });
      const set = new SceneVariableSet({ variables: [v] });
      const result = serializeVariableSet(set);

      expect(result).toEqual([
        {
          name: 'env',
          label: 'Environment',
          description: 'Select environment',
          query: 'dev,staging,prod',
          isMulti: true,
          includeAll: true,
          allValue: '*',
          allowCustomValue: true,
          value: ['dev', 'staging'],
          text: ['dev', 'staging'],
        },
      ]);
    });

    it('should serialize multiple variables', () => {
      const v1 = new CustomVariable({ name: 'job', query: 'a,b', value: 'a', text: 'a' });
      const v2 = new CustomVariable({ name: 'env', query: 'dev,prod', value: 'dev', text: 'dev' });
      const set = new SceneVariableSet({ variables: [v1, v2] });
      const result = serializeVariableSet(set);

      expect(result).toHaveLength(2);
      expect(result?.[0].name).toBe('job');
      expect(result?.[1].name).toBe('env');
    });

    it('should omit optional fields that are not set', () => {
      const v = new CustomVariable({ name: 'simple', query: 'a,b', value: 'a', text: 'a' });
      const set = new SceneVariableSet({ variables: [v] });
      const result = serializeVariableSet(set);

      expect(result?.[0]).not.toHaveProperty('label');
      expect(result?.[0]).not.toHaveProperty('description');
      expect(result?.[0]).not.toHaveProperty('isMulti');
      expect(result?.[0]).not.toHaveProperty('includeAll');
      expect(result?.[0]).not.toHaveProperty('allValue');
      expect(result?.[0]).not.toHaveProperty('allowCustomValue');
    });
  });

  describe('deserializeVariables', () => {
    it('should deserialize a basic CustomVariable', () => {
      const result = deserializeVariables([{ name: 'job', query: 'demo,node', value: 'demo', text: 'demo' }]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CustomVariable);
      expect(result[0].state.name).toBe('job');
      const cv = result[0] as CustomVariable;
      expect(cv.state.query).toBe('demo,node');
      expect(String(cv.state.value)).toBe('demo');
      expect(String(cv.state.text)).toBe('demo');
    });

    it('should deserialize with all optional fields', () => {
      const result = deserializeVariables([
        {
          name: 'env',
          label: 'Environment',
          description: 'Select environment',
          query: 'dev,staging,prod',
          isMulti: true,
          includeAll: true,
          allValue: '*',
          allowCustomValue: true,
          value: ['dev', 'staging'],
          text: ['dev', 'staging'],
        },
      ]);

      expect(result).toHaveLength(1);
      const v = result[0] as CustomVariable;
      expect(v.state.name).toBe('env');
      expect(v.state.label).toBe('Environment');
      expect(v.state.description).toBe('Select environment');
      expect(v.state.query).toBe('dev,staging,prod');
      expect(v.state.isMulti).toBe(true);
      expect(v.state.includeAll).toBe(true);
      expect(v.state.allValue).toBe('*');
      expect(v.state.allowCustomValue).toBe(true);
      expect(v.state.value).toEqual(['dev', 'staging']);
      expect(v.state.text).toEqual(['dev', 'staging']);
    });

    it('should filter out entries with empty or missing names', () => {
      const result = deserializeVariables([
        { name: '', query: 'a,b' },
        { name: 'valid', query: 'c,d' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].state.name).toBe('valid');
    });

    it('should handle empty array', () => {
      const result = deserializeVariables([]);
      expect(result).toHaveLength(0);
    });

    it('should handle missing value and text fields', () => {
      const result = deserializeVariables([{ name: 'job', query: 'a,b' }]);

      expect(result).toHaveLength(1);
      expect(result[0].state.name).toBe('job');
      expect((result[0] as CustomVariable).state.query).toBe('a,b');
    });

    it('should round-trip serialize and deserialize', () => {
      const original = new CustomVariable({
        name: 'env',
        label: 'Environment',
        description: 'test',
        query: 'dev,prod',
        isMulti: true,
        includeAll: true,
        allValue: '*',
        allowCustomValue: true,
        value: 'dev',
        text: 'dev',
      });
      const set = new SceneVariableSet({ variables: [original] });

      const serialized = serializeVariableSet(set);
      const deserialized = deserializeVariables(serialized!);

      expect(deserialized).toHaveLength(1);
      const v = deserialized[0] as CustomVariable;
      expect(v.state.name).toBe('env');
      expect(v.state.label).toBe('Environment');
      expect(v.state.description).toBe('test');
      expect(v.state.query).toBe('dev,prod');
      expect(v.state.isMulti).toBe(true);
      expect(v.state.includeAll).toBe(true);
      expect(v.state.allValue).toBe('*');
      expect(v.state.allowCustomValue).toBe(true);
      expect(String(v.state.value)).toBe('dev');
      expect(String(v.state.text)).toBe('dev');
    });
  });
});
