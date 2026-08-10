import { ConstantVariable, SceneVariableSet } from '@grafana/scenes';

import { cloneSectionVariableSet, getCloneKey } from './clone';

describe('clone', () => {
  describe('getCloneKey', () => {
    it('should return the clone key', () => {
      expect(getCloneKey('panel-1', 1)).toBe('panel-1-clone-1');
      expect(getCloneKey('panel-22', 1)).toBe('panel-22-clone-1');
    });
  });

  describe('cloneSectionVariableSet', () => {
    it('assigns new keys to the set and each variable', () => {
      const constant = new ConstantVariable({ name: 'env', value: 'prod' });
      const variableSet = new SceneVariableSet({ variables: [constant] });

      const cloned = cloneSectionVariableSet(variableSet);

      expect(cloned).not.toBe(variableSet);
      expect(cloned!.state.key).not.toBe(variableSet.state.key);
      expect(cloned!.state.variables[0]).not.toBe(constant);
      expect(cloned!.state.variables[0].state.key).not.toBe(constant.state.key);
      expect(cloned!.state.variables[0].state.name).toBe('env');
    });
  });
});
