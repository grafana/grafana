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
      expect(snapshot.state.text).toBe(multiVariable.text);
      expect(snapshot.state.hide).toBe(multiVariable.hide);
    });
  });
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

  return { multiVariable };
}
