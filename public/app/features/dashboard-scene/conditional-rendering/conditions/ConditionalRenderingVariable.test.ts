import { CustomVariable, EmbeddedScene, SceneVariableSet } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

function buildSceneTree({
  condition,
  variables,
}: {
  condition: ConditionalRenderingVariable;
  variables: CustomVariable[];
}) {
  const group = new ConditionalRenderingGroup({
    conditions: [condition],
    condition: 'and',
    visibility: 'show',
    result: true,
    renderHidden: false,
  });

  const scene = new EmbeddedScene({
    $variables: new SceneVariableSet({ variables }),
    body: group,
  });

  return { group, scene };
}

describe('ConditionalRenderingVariable', () => {
  describe('evaluation', () => {
    test('when operator is = and variable value matches, result is true', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is = and variable value does not match, result is false', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: 'staging',
        text: 'staging',
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(false);
    });

    test('when operator is = and multi-value variable includes comparison value, result is true', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: ['dev', 'staging'],
        text: ['dev', 'staging'],
        isMulti: true,
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'staging',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is = and multi-value variable with All selected matches All comparison, result is true', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: '$__all',
        text: 'All',
        isMulti: true,
        includeAll: true,
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'All',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is != and variable value matches, result is false', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '!=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(false);
    });

    test('when operator is != and variable value does not match, result is true', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: 'staging',
        text: 'staging',
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '!=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is =~ and variable value matches regex, result is true', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: 'staging',
        text: 'staging',
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=~',
        value: 'stag.*',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is =~ and variable value does not match regex, result is false', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=~',
        value: 'stag.*',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(false);
    });

    test('when operator is =~ and regex is invalid, result is true', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=~',
        value: '[invalid',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is =~ and multi-value variable has a matching value, result is true', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: ['dev', 'staging'],
        text: ['dev', 'staging'],
        isMulti: true,
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=~',
        value: 'stag.*',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when operator is !~ and variable value matches regex, result is false', () => {
      const variable = new CustomVariable({
        name: 'env',
        query: 'dev,staging,prod',
        value: 'staging',
        text: 'staging',
      });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '!~',
        value: 'stag.*',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(false);
    });

    test('when operator is !~ and variable value does not match regex, result is true', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '!~',
        value: 'stag.*',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);
    });

    test('when variable name is empty, result is undefined', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: '',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBeUndefined();
    });

    test('when variable is not found in the scene, result is undefined', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'nonexistent',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBeUndefined();
    });
  });

  describe('reactivity', () => {
    test('when variable value changes, result is recalculated', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);

      variable.changeValueTo('staging', 'staging');

      expect(condition.state.result).toBe(false);
    });

    test('when result changes, it triggers a group check', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { group, scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      const checkSpy = jest.spyOn(group, 'check');

      variable.changeValueTo('staging', 'staging');

      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('change methods', () => {
    test('when changeVariable() is called, result is recalculated', () => {
      const envVar = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const regionVar = new CustomVariable({ name: 'region', query: 'us,eu', value: 'us', text: 'us' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'us',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [envVar, regionVar] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(false);

      condition.changeVariable('region');

      expect(condition.state.result).toBe(true);
    });

    test('when changeOperator() is called, result is recalculated', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);

      condition.changeOperator('!=');

      expect(condition.state.result).toBe(false);
    });

    test('when changeValue() is called, result is recalculated', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      expect(condition.state.result).toBe(true);

      condition.changeValue('staging');

      expect(condition.state.result).toBe(false);
    });

    test('when changeValue() is called with the same value, state and result are not updated', () => {
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '=',
        value: 'dev',
        result: undefined,
      });
      const { scene } = buildSceneTree({ condition, variables: [variable] });

      activateFullSceneTree(scene);

      const resultBefore = condition.state.result;
      const setStateSpy = jest.spyOn(condition, 'setState');

      condition.changeValue('dev');

      expect(setStateSpy).not.toHaveBeenCalled();
      expect(condition.state.result).toBe(resultBefore);
    });
  });

  describe('serialization', () => {
    test('serialize() maps short operators to long names', () => {
      const condition = new ConditionalRenderingVariable({
        variable: 'env',
        operator: '!=',
        value: 'dev',
        result: undefined,
      });

      const result = condition.serialize();

      expect(result).toEqual({
        kind: 'ConditionalRenderingVariable',
        spec: { variable: 'env', operator: 'notEquals', value: 'dev' },
      });
    });

    test('deserialize() maps long operator names to short ones', () => {
      const model = {
        kind: 'ConditionalRenderingVariable' as const,
        spec: { variable: 'env', operator: 'matches' as const, value: 'stag.*' },
      };

      const condition = ConditionalRenderingVariable.deserialize(model);

      expect(condition).toBeInstanceOf(ConditionalRenderingVariable);
      expect(condition.state.variable).toBe('env');
      expect(condition.state.operator).toBe('=~');
      expect(condition.state.value).toBe('stag.*');
      expect(condition.state.result).toBeUndefined();
    });
  });

  test('createEmpty() defaults to operator = and empty value', () => {
    const condition = ConditionalRenderingVariable.createEmpty('env');

    expect(condition).toBeInstanceOf(ConditionalRenderingVariable);
    expect(condition.state.variable).toBe('env');
    expect(condition.state.operator).toBe('=');
    expect(condition.state.value).toBe('');
    expect(condition.state.result).toBeUndefined();
  });
});
