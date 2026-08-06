import { setupEditActionTest } from '../test-utils';

import { removeVariable } from './removeVariable';

describe('removeVariable', () => {
  it('removes the variable from the dashboard and restores it on undo', () => {
    const ctx = setupEditActionTest();
    const variableSet = ctx.getVariableSet();

    removeVariable({ source: variableSet, removedObject: variableSet.state.variables[0] });

    expect(ctx.getSpec().variables).toHaveLength(0);

    ctx.undo();

    ctx.expectRestoredToInitialSpec();
  });
});
