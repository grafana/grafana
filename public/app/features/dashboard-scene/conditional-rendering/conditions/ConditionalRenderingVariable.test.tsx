import { render, screen } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('ConditionalRenderingVariable', () => {
  describe('evaluate()', () => {
    describe('equals operator (=)', () => {
      it('should return true when single variable value equals condition value', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'A',
          operator: '=',
        });

        expect(condition.state.result).toBe(true);
      });

      it('should return false when single variable value does not equal condition value', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'B',
          operator: '=',
        });

        expect(condition.state.result).toBe(false);
      });

      it('should return true when array contains the condition value (multi-select)', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'B',
          operator: '=',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['A', 'B', 'C'], ['A', 'B', 'C']);
        condition.forceCheck();

        expect(condition.state.result).toBe(true);
      });

      it('should return false when array does not contain the condition value', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'D',
          operator: '=',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['A', 'B', 'C'], ['A', 'B', 'C']);
        condition.forceCheck();

        expect(condition.state.result).toBe(false);
      });

      it('should handle empty string value', () => {
        const { condition } = buildTestScene({
          variableValue: '',
          conditionValue: '',
          operator: '=',
        });

        expect(condition.state.result).toBe(true);
      });
    });

    describe('not equals operator (!=)', () => {
      it('should return true when variable value does not equal condition value', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'B',
          operator: '!=',
        });

        expect(condition.state.result).toBe(true);
      });

      it('should return false when variable value equals condition value', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'A',
          operator: '!=',
        });

        expect(condition.state.result).toBe(false);
      });

      it('should return true when array does not contain the condition value', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'D',
          operator: '!=',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['A', 'B', 'C'], ['A', 'B', 'C']);
        condition.forceCheck();

        expect(condition.state.result).toBe(true);
      });

      it('should return false when array contains the condition value', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'B',
          operator: '!=',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['A', 'B', 'C'], ['A', 'B', 'C']);
        condition.forceCheck();

        expect(condition.state.result).toBe(false);
      });
    });

    describe('regex match operator (=~)', () => {
      it('should return true when variable value matches regex pattern', () => {
        const { condition } = buildTestScene({
          variableValue: 'hello-world',
          conditionValue: 'hello.*',
          operator: '=~',
        });

        expect(condition.state.result).toBe(true);
      });

      it('should return false when variable value does not match regex pattern', () => {
        const { condition } = buildTestScene({
          variableValue: 'goodbye-world',
          conditionValue: 'hello.*',
          operator: '=~',
        });

        expect(condition.state.result).toBe(false);
      });

      it('should return true when any array value matches regex (multi-select)', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'foo',
          conditionValue: 'hello.*',
          operator: '=~',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['foo', 'hello-world', 'bar'], ['foo', 'hello-world', 'bar']);
        condition.forceCheck();

        expect(condition.state.result).toBe(true);
      });

      it('should return false when no array value matches regex', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'foo',
          conditionValue: 'hello.*',
          operator: '=~',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['foo', 'bar', 'baz'], ['foo', 'bar', 'baz']);
        condition.forceCheck();

        expect(condition.state.result).toBe(false);
      });

      it('should return true (fallback) for invalid regex', () => {
        const { condition } = buildTestScene({
          variableValue: 'test',
          conditionValue: '[invalid regex',
          operator: '=~',
        });

        expect(condition.state.result).toBe(true);
      });

      it('should handle special regex characters', () => {
        const { condition } = buildTestScene({
          variableValue: 'test.value',
          conditionValue: 'test\\.value',
          operator: '=~',
        });

        expect(condition.state.result).toBe(true);
      });
    });

    describe('regex not match operator (!~)', () => {
      it('should return true when variable value does not match regex', () => {
        const { condition } = buildTestScene({
          variableValue: 'goodbye-world',
          conditionValue: 'hello.*',
          operator: '!~',
        });

        expect(condition.state.result).toBe(true);
      });

      it('should return false when variable value matches regex', () => {
        const { condition } = buildTestScene({
          variableValue: 'hello-world',
          conditionValue: 'hello.*',
          operator: '!~',
        });

        expect(condition.state.result).toBe(false);
      });

      it('should return true when no array value matches regex', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'foo',
          conditionValue: 'hello.*',
          operator: '!~',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['foo', 'bar', 'baz'], ['foo', 'bar', 'baz']);
        condition.forceCheck();

        expect(condition.state.result).toBe(true);
      });

      it('should return false when any array value matches regex', () => {
        const { condition, variable } = buildTestScene({
          variableValue: 'foo',
          conditionValue: 'hello.*',
          operator: '!~',
        });

        // Set array value using changeValueTo
        variable.changeValueTo(['foo', 'hello-world', 'bar'], ['foo', 'hello-world', 'bar']);
        condition.forceCheck();

        expect(condition.state.result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return undefined when variable name is empty', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'A',
          operator: '=',
          variableName: '',
        });

        expect(condition.state.result).toBe(undefined);
      });

      it('should return undefined when variable does not exist', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'A',
          operator: '=',
          variableName: 'nonexistent',
        });

        expect(condition.state.result).toBe(undefined);
      });

      it('should re-evaluate when changeValue is called with new value', () => {
        const { condition } = buildTestScene({
          variableValue: 'A',
          conditionValue: 'B',
          operator: '=',
        });

        expect(condition.state.result).toBe(false);

        // Change the condition value to match
        condition.changeValue('A');

        expect(condition.state.result).toBe(true);
      });

      it('should handle numeric values as strings', () => {
        const { condition } = buildTestScene({
          variableValue: '123',
          conditionValue: '123',
          operator: '=',
        });

        expect(condition.state.result).toBe(true);
      });
    });
  });

  describe('state changes', () => {
    it('should update result when changeVariable is called', () => {
      const variable1 = new TestVariable({
        name: 'var1',
        value: 'A',
        text: 'A',
        delayMs: 0,
        optionsToReturn: [{ label: 'A', value: 'A' }],
      });

      const variable2 = new TestVariable({
        name: 'var2',
        value: 'B',
        text: 'B',
        delayMs: 0,
        optionsToReturn: [{ label: 'B', value: 'B' }],
      });

      const condition = new ConditionalRenderingVariable({
        variable: 'var1',
        operator: '=',
        value: 'A',
        result: undefined,
      });

      const group = new ConditionalRenderingGroup({
        condition: 'and',
        visibility: 'show',
        conditions: [condition],
        result: true,
        renderHidden: false,
      });

      const panel = new VizPanel({
        title: 'Test Panel',
        pluginId: 'timeseries',
      });

      const gridItem = new DashboardGridItem({
        body: panel,
        $behaviors: [group],
      });

      const dashboard = new DashboardScene({
        uid: 'test',
        $variables: new SceneVariableSet({
          variables: [variable1, variable2],
        }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [gridItem],
          }),
        }),
      });

      activateFullSceneTree(dashboard);
      group.setTarget(gridItem);

      expect(condition.state.result).toBe(true);

      condition.changeVariable('var2');

      expect(condition.state.variable).toBe('var2');
      expect(condition.state.result).toBe(false);
    });

    it('should update result when changeOperator is called', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'B',
        operator: '=',
      });

      expect(condition.state.result).toBe(false);

      condition.changeOperator('!=');

      expect(condition.state.operator).toBe('!=');
      expect(condition.state.result).toBe(true);
    });

    it('should update result when changeValue is called', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'B',
        operator: '=',
      });

      expect(condition.state.result).toBe(false);

      condition.changeValue('A');

      expect(condition.state.value).toBe('A');
      expect(condition.state.result).toBe(true);
    });

    it('should not update state if value is the same', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'A',
        operator: '=',
      });

      const setStateSpy = jest.spyOn(condition, 'setState');
      condition.changeValue('A');

      expect(setStateSpy).not.toHaveBeenCalled();
    });
  });

  describe('serialization', () => {
    it('should serialize to ConditionalRenderingVariableKind', () => {
      const condition = new ConditionalRenderingVariable({
        variable: 'myVar',
        operator: '=',
        value: 'myValue',
        result: undefined,
      });

      const serialized = condition.serialize();

      expect(serialized).toEqual({
        kind: 'ConditionalRenderingVariable',
        spec: {
          variable: 'myVar',
          operator: 'equals',
          value: 'myValue',
        },
      });
    });

    it('should serialize notEquals operator correctly', () => {
      const condition = new ConditionalRenderingVariable({
        variable: 'myVar',
        operator: '!=',
        value: 'myValue',
        result: undefined,
      });

      expect(condition.serialize().spec.operator).toBe('notEquals');
    });

    it('should serialize matches operator correctly', () => {
      const condition = new ConditionalRenderingVariable({
        variable: 'myVar',
        operator: '=~',
        value: 'myValue',
        result: undefined,
      });

      expect(condition.serialize().spec.operator).toBe('matches');
    });

    it('should serialize notMatches operator correctly', () => {
      const condition = new ConditionalRenderingVariable({
        variable: 'myVar',
        operator: '!~',
        value: 'myValue',
        result: undefined,
      });

      expect(condition.serialize().spec.operator).toBe('notMatches');
    });

    it('should deserialize from ConditionalRenderingVariableKind', () => {
      const deserialized = ConditionalRenderingVariable.deserialize({
        kind: 'ConditionalRenderingVariable',
        spec: {
          variable: 'myVar',
          operator: 'equals',
          value: 'myValue',
        },
      });

      expect(deserialized.state.variable).toBe('myVar');
      expect(deserialized.state.operator).toBe('=');
      expect(deserialized.state.value).toBe('myValue');
      expect(deserialized.state.result).toBe(undefined);
    });

    it('should deserialize notEquals operator correctly', () => {
      const deserialized = ConditionalRenderingVariable.deserialize({
        kind: 'ConditionalRenderingVariable',
        spec: {
          variable: 'myVar',
          operator: 'notEquals',
          value: 'myValue',
        },
      });

      expect(deserialized.state.operator).toBe('!=');
    });

    it('should deserialize matches operator correctly', () => {
      const deserialized = ConditionalRenderingVariable.deserialize({
        kind: 'ConditionalRenderingVariable',
        spec: {
          variable: 'myVar',
          operator: 'matches',
          value: 'myValue',
        },
      });

      expect(deserialized.state.operator).toBe('=~');
    });

    it('should deserialize notMatches operator correctly', () => {
      const deserialized = ConditionalRenderingVariable.deserialize({
        kind: 'ConditionalRenderingVariable',
        spec: {
          variable: 'myVar',
          operator: 'notMatches',
          value: 'myValue',
        },
      });

      expect(deserialized.state.operator).toBe('!~');
    });
  });

  describe('createEmpty', () => {
    it('should create an empty condition with default values', () => {
      const condition = ConditionalRenderingVariable.createEmpty('testVar');

      expect(condition.state.variable).toBe('testVar');
      expect(condition.state.operator).toBe('=');
      expect(condition.state.value).toBe('');
      expect(condition.state.result).toBe(undefined);
    });
  });

  describe('Component', () => {
    it('should render without errors', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'A',
        operator: '=',
      });

      expect(() => {
        render(<condition.Component model={condition} />);
      }).not.toThrow();
    });

    it('should render variable selector, operator selector, and value input', async () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'testValue',
        operator: '=',
      });

      render(<condition.Component model={condition} />);

      // Check that the value input is rendered with the correct value
      const valueInput = screen.getByPlaceholderText('Value');
      expect(valueInput).toBeInTheDocument();
      expect(valueInput).toHaveValue('testValue');
    });

    it('should show regex validation error for invalid regex', async () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: '[invalid',
        operator: '=~',
      });

      render(<condition.Component model={condition} />);

      // The invalid regex message should be shown
      expect(screen.getByText('Invalid regex')).toBeInTheDocument();
    });

    it('should not show regex validation error for valid regex', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: 'valid.*regex',
        operator: '=~',
      });

      render(<condition.Component model={condition} />);

      expect(screen.queryByText('Invalid regex')).not.toBeInTheDocument();
    });

    it('should not show regex validation for non-regex operators', () => {
      const { condition } = buildTestScene({
        variableValue: 'A',
        conditionValue: '[invalid',
        operator: '=',
      });

      render(<condition.Component model={condition} />);

      expect(screen.queryByText('Invalid regex')).not.toBeInTheDocument();
    });
  });
});

interface BuildTestSceneOptions {
  variableValue: string;
  conditionValue: string;
  operator: '=' | '!=' | '=~' | '!~';
  variableName?: string;
}

function buildTestScene(options: BuildTestSceneOptions) {
  const { variableValue, conditionValue, operator, variableName = 'testVar' } = options;

  const variable = new TestVariable({
    name: 'testVar',
    value: variableValue,
    text: variableValue,
    delayMs: 0,
    optionsToReturn: [{ label: variableValue, value: variableValue }],
  });

  const condition = new ConditionalRenderingVariable({
    variable: variableName,
    operator,
    value: conditionValue,
    result: undefined,
  });

  const group = new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [condition],
    result: true,
    renderHidden: false,
  });

  const panel = new VizPanel({
    title: 'Test Panel',
    pluginId: 'timeseries',
  });

  const gridItem = new DashboardGridItem({
    body: panel,
    $behaviors: [group],
  });

  const dashboard = new DashboardScene({
    uid: 'test',
    $variables: new SceneVariableSet({
      variables: [variable],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [gridItem],
      }),
    }),
  });

  activateFullSceneTree(dashboard);
  group.setTarget(gridItem);

  return { dashboard, condition, variable, group, panel, gridItem };
}
