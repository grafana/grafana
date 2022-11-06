import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../core/types';

import { VariableDependencyConfig } from './VariableDependencyConfig';

interface TestState extends SceneObjectStatePlain {
  query: string;
  otherProp: string;
  nested: {
    query: string;
  };
}

class TestObj extends SceneObjectBase<TestState> {
  constructor() {
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
  it('Should be able to extract dependencies', () => {
    const sceneObj = new TestObj();
    const deps = new VariableDependencyConfig(sceneObj, { statePaths: ['query', 'nested'] });

    expect(deps.getNames()).toEqual(new Set(['queryVarA', 'queryVarB', 'nestedVarA']));
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
});
