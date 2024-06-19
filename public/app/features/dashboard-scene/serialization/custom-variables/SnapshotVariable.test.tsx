import { SnapshotVariable } from './SnapshotVariable';

describe('SnapshotVariable', () => {
  describe('SnapshotVariable state', () => {
    it('should create a new snapshotVariable when custom variable is passed', () => {
      const { multiVariable } = setupScene();
      const snapshot = new SnapshotVariable(multiVariable);
      //expect snapshot to be defined
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.state.type).toBe('snapshot');
      expect(snapshot.state.isReadOnly).toBe(true);
      expect(snapshot.state.value).toBe(multiVariable.value);
      expect(snapshot.state.filters).toEqual([]);
      expect(snapshot.state.text).toBe(multiVariable.text);
      expect(snapshot.state.hide).toBe(multiVariable.hide);
    });

    it('should create a new snapshotVariable when custom variable is passed', () => {
      const { adhocVariable } = setupScene();
      const snapshot = new SnapshotVariable(adhocVariable);
      //expect snapshot to be defined
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.state.type).toBe('snapshot');
      expect(snapshot.state.isReadOnly).toBe(true);
      expect(snapshot.state.filters).toEqual(adhocVariable.filters);
      expect(snapshot.state.hide).toBe(adhocVariable.hide);
    });
  });
  describe('SnapshotVariable renderer', () => {});
});

function setupScene() {
  // create custom variable type custom

  const multiVariable = {
    name: 'Multi',
    description: 'Define variable values manually',
    text: 'myMultiText',
    value: 'myMultiValue',
    multi: true,
    hide: 0,
  };

  const adhocVariable = {
    name: 'Ad hoc filters',
    description: 'Add key/value filters on the fly',
    text: '',
    value: '',
    filters: [{ key: 'key', operator: 'operator', value: 'value' }],
    hide: 0,
  };

  return { multiVariable, adhocVariable };
}
