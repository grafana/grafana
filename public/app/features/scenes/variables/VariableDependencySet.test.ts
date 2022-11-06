import { VariableDependencySet } from './VariableDependencySet';

class TestState {
  query = 'query with ${varA}';
  otherProp = 'string with ${varB}';
  nested = {
    query: 'nested object with ${varC}',
  };
}

describe('VariableDependencySet', () => {
  it('Should be able to extract dependencies', () => {
    const state = new TestState();
    const deps = new VariableDependencySet<TestState>(['query', 'nested']);

    expect(deps.getVariableDependencies(state)).toEqual(new Set(['varA', 'varC']));
  });

  it('Should cache variable extraction', () => {
    const state = new TestState();
    const deps = new VariableDependencySet<TestState>(['query', 'nested']);

    deps.getVariableDependencies(state);
    deps.getVariableDependencies(state);

    expect(deps.scanCount).toBe(1);
  });

  it('Should not rescan if state changes but not any of the state paths to scan', () => {
    const state = new TestState();
    const deps = new VariableDependencySet<TestState>(['query', 'nested']);
    deps.getVariableDependencies(state);

    const newState = new TestState();
    newState.nested = state.nested;

    deps.getVariableDependencies(newState);
    expect(deps.scanCount).toBe(1);
  });

  it('Should re-scan when both stata and specific state path change', () => {
    const state = new TestState();
    const deps = new VariableDependencySet<TestState>(['query', 'nested']);
    deps.getVariableDependencies(state);

    const newState = new TestState();
    newState.query = 'new query with ${newVar}';
    newState.nested.query = 'no variable here any more';

    expect(deps.getVariableDependencies(newState)).toEqual(new Set(['newVar']));
    expect(deps.scanCount).toBe(2);
  });
});
