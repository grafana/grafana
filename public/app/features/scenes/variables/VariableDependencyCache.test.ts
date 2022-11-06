import { VariableDependencyCache } from './VariableDependencyCache';

class TestState {
  query = 'query with ${queryVarA} ${queryVarB}';
  otherProp = 'string with ${otherPropA}';
  nested = {
    query: 'nested object with ${nestedVarA}',
  };
}

describe('VariableDependencySet', () => {
  it('Should be able to extract dependencies', () => {
    const state = new TestState();
    const deps = new VariableDependencyCache<TestState>(['query', 'nested']);

    expect(deps.getAll(state)).toEqual(new Set(['queryVarA', 'queryVarB', 'nestedVarA']));
  });

  it('Should cache variable extraction', () => {
    const state = new TestState();
    const deps = new VariableDependencyCache<TestState>(['query', 'nested']);

    deps.getAll(state);
    deps.getAll(state);

    expect(deps.scanCount).toBe(1);
  });

  it('Should not rescan if state changes but not any of the state paths to scan', () => {
    const state = new TestState();
    const deps = new VariableDependencyCache<TestState>(['query', 'nested']);
    deps.getAll(state);

    const newState = new TestState();
    newState.nested = state.nested;

    deps.getAll(newState);
    expect(deps.scanCount).toBe(1);
  });

  it('Should re-scan when both stata and specific state path change', () => {
    const state = new TestState();
    const deps = new VariableDependencyCache<TestState>(['query', 'nested']);
    deps.getAll(state);

    const newState = new TestState();
    newState.query = 'new query with ${newVar}';
    newState.nested.query = 'no variable here any more';

    expect(deps.getAll(newState)).toEqual(new Set(['newVar']));
    expect(deps.scanCount).toBe(2);
  });
});
