import { CustomVariable } from '@grafana/scenes';

import { setupEditActionTest } from '../test-utils';

import { addVariable } from './addVariable';

describe('addVariable', () => {
  it('appends the variable to the dashboard and removes it again on undo', () => {
    const ctx = setupEditActionTest();
    const variableSet = ctx.getVariableSet();

    addVariable({
      source: variableSet,
      addedObject: new CustomVariable({ name: 'env', query: 'dev,prod', value: 'dev', text: 'dev' }),
    });

    ctx.expectSpec({
      variables: [{ spec: { name: 'app' } }, { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,prod' } }],
    });

    ctx.undo();

    ctx.expectRestoredToInitialSpec();
  });

  it('keeps both variables when two are added and only the last one is undone', () => {
    const ctx = setupEditActionTest();
    const variableSet = ctx.getVariableSet();

    addVariable({ source: variableSet, addedObject: new CustomVariable({ name: 'env', query: 'dev' }) });
    addVariable({ source: variableSet, addedObject: new CustomVariable({ name: 'region', query: 'eu' }) });

    expect(ctx.getSpec().variables).toHaveLength(3);

    ctx.undo();

    ctx.expectSpec({ variables: [{ spec: { name: 'app' } }, { spec: { name: 'env' } }] });

    ctx.undoAll();

    ctx.expectRestoredToInitialSpec();
  });
});
