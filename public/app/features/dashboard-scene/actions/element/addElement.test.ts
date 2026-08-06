import { setupEditActionTest } from '../test-utils';

describe('addElement', () => {
  // Driven through the dashboard rather than by calling addElement directly, so the perform/undo
  // pair under test is the one the layout managers actually pass in.
  it('adds a panel to the dashboard and removes it again on undo', () => {
    const ctx = setupEditActionTest();

    expect(Object.keys(ctx.getSpec().elements)).toEqual(['panel-1']);

    ctx.dashboard.onCreateNewPanel();

    expect(Object.keys(ctx.getSpec().elements)).toHaveLength(2);
    expect(ctx.getSpec().layout).toMatchObject({ spec: { items: [{}, {}] } });

    ctx.undo();

    ctx.expectRestoredToInitialSpec();
  });
});
