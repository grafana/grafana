import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { VariableDependencyConfig } from './VariableDependencyConfig';
import { ConstantVariable } from './variants/ConstantVariable';

interface TestState extends SceneObjectStatePlain {
  query: string;
  otherProp: string;
  nested: {
    query: string;
  };
}

class TestObj extends SceneObjectBase<TestState> {
  public constructor() {
    super({
      query: 'query with ${queryVarA} ${queryVarB}',
      otherProp: 'string with ${otherPropA}',
      nested: {
        query: 'nested object with ${nestedVarA}',
      },
    });
  }
}

describe('VariableDependencySet', () => {
  it('Should be able to extract dependencies from all state', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, {});

    expect(deps.getNames()).toEqual(new Set(['queryVarA', 'queryVarB', 'nestedVarA', 'otherPropA']));
  });

  it('Should be able to extract dependencies from statePaths', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, { statePaths: ['query', 'nested'] });

    expect(deps.getNames()).toEqual(new Set(['queryVarA', 'queryVarB', 'nestedVarA']));
    expect(deps.hasDependencyOn('queryVarA')).toBe(true);
  });

  it('Should cache variable extraction', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, { statePaths: ['query', 'nested'] });

    deps.getNames();
    deps.getNames();

    expect(deps.scanCount).toBe(1);
  });

  it('Should not rescan if state changes but not any of the state paths to scan', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, { statePaths: ['query', 'nested'] });
    deps.getNames();

    sceneObj.setState({ otherProp: 'new value' });

    deps.getNames();
    expect(deps.scanCount).toBe(1);
  });

  it('Should re-scan when both state and specific state path change', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, { statePaths: ['query', 'nested'] });
    deps.getNames();

    sceneObj.setState({ query: 'new query with ${newVar}' });

    expect(deps.getNames()).toEqual(new Set(['newVar', 'nestedVarA']));
    expect(deps.scanCount).toBe(2);
  });

  it('variableValuesChanged should only call onReferencedVariableValueChanged if dependent variable has changed', () => {
    const sceneObj = new TestObj();
    const fn = jest.fn();
    const deps = new VariableDependencyConfig(sceneObj, { onReferencedVariableValueChanged: fn });

    deps.variableValuesChanged(new Set([new ConstantVariable({ name: 'not-dep', value: '1' })]));
    expect(fn.mock.calls.length).toBe(0);

    deps.variableValuesChanged(new Set([new ConstantVariable({ name: 'queryVarA', value: '1' })]));
    expect(fn.mock.calls.length).toBe(1);
  });
});
