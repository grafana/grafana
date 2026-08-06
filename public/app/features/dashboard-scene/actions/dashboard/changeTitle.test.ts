import { setupEditActionTest } from '../test-utils';

import { changeTitle } from './changeTitle';

describe('changeTitle', () => {
  it('changes the dashboard title and restores the previous one on undo', () => {
    const ctx = setupEditActionTest({ title: 'Original title' });

    changeTitle({ source: ctx.dashboard, oldValue: 'Original title', newValue: 'Renamed dashboard' });

    ctx.expectSpec({ title: 'Renamed dashboard' });
    expect(ctx.getHistorySizes()).toEqual({ undo: 1, redo: 0 });

    ctx.undo();

    ctx.expectRestoredToInitialSpec();
    expect(ctx.getHistorySizes()).toEqual({ undo: 0, redo: 1 });
  });

  it('rolls back every title change when several are undone', () => {
    const ctx = setupEditActionTest({ title: 'First' });

    changeTitle({ source: ctx.dashboard, oldValue: 'First', newValue: 'Second' });
    ctx.expectSpec({ title: 'Second' });

    changeTitle({ source: ctx.dashboard, oldValue: 'Second', newValue: 'Third' });
    ctx.expectSpec({ title: 'Third' });

    ctx.undo();
    ctx.expectSpec({ title: 'Second' });

    ctx.undoAll();
    ctx.expectRestoredToInitialSpec();
  });

  it('reapplies the title on redo', () => {
    const ctx = setupEditActionTest({ title: 'Original title' });

    changeTitle({ source: ctx.dashboard, oldValue: 'Original title', newValue: 'Renamed dashboard' });
    ctx.undo();
    ctx.redo();

    ctx.expectSpec({ title: 'Renamed dashboard' });
    expect(ctx.getHistorySizes()).toEqual({ undo: 1, redo: 0 });
  });
});
