import {
  capturePanelRender,
  getPanelRenderData,
  getPanelRenderStatus,
  getPanelRenderStatuses,
  getReportingPanelIds,
  registerPanelRenderReporter,
} from './panelRenderStatus';

describe('panelRenderStatus', () => {
  it('starts pending and keeps the last report', () => {
    let now = 100;
    const reporter = registerPanelRenderReporter(4, 'custom-panel', () => now);
    expect(getPanelRenderStatus(4)).toEqual({
      panelId: 4,
      pluginId: 'custom-panel',
      state: 'pending',
      final: false,
      updatedAt: 100,
    });

    now = 250;
    reporter.report({ state: 'drawn', final: true, dataState: 'Done', digest: 'abc', durationMs: 3, nodeCount: 12 });
    expect(getPanelRenderStatus(4)).toEqual({
      panelId: 4,
      pluginId: 'custom-panel',
      state: 'drawn',
      final: true,
      dataState: 'Done',
      digest: 'abc',
      durationMs: 3,
      nodeCount: 12,
      updatedAt: 250,
    });
    reporter.dispose();
  });

  it('answers with the most recently mounted instance and falls back when it unmounts', () => {
    const dashboard = registerPanelRenderReporter(7, 'custom-panel');
    dashboard.report({ state: 'drawn', final: true });
    const editor = registerPanelRenderReporter(7, 'custom-panel');
    editor.report({ state: 'error', final: true, error: { kind: 'runtime', message: 'boom' } });
    expect(getPanelRenderStatus(7)?.state).toBe('error');

    editor.dispose();
    expect(getPanelRenderStatus(7)?.state).toBe('drawn');
    dashboard.dispose();
    expect(getPanelRenderStatus(7)).toBeUndefined();
    expect(getReportingPanelIds()).not.toContain(7);
  });

  it('ignores reports after dispose and captures through the registered capture', async () => {
    const reporter = registerPanelRenderReporter(9, 'custom-panel');
    expect(capturePanelRender(9)).toBeUndefined();
    reporter.setCapture(() => Promise.resolve('data:image/png;base64,AA=='));
    await expect(capturePanelRender(9)).resolves.toBe('data:image/png;base64,AA==');

    reporter.dispose();
    reporter.report({ state: 'drawn', final: true });
    expect(getPanelRenderStatus(9)).toBeUndefined();
  });

  it('answers once per instance key: repeat clones each, the editor and dashboard together', async () => {
    const dashboard = registerPanelRenderReporter(6, 'custom-panel', Date.now, 'panel-6');
    const clone = registerPanelRenderReporter(6, 'custom-panel', Date.now, 'panel-6-clone-1');
    const editor = registerPanelRenderReporter(6, 'custom-panel', Date.now, 'panel-6');
    clone.report({ state: 'error', final: true, error: { kind: 'runtime', message: 'boom' } });
    clone.setCapture(() => Promise.resolve('data:image/png;base64,CC=='));
    editor.report({ state: 'drawn', final: true });

    expect(getPanelRenderStatuses(6).map((status) => [status.instanceKey, status.state])).toEqual([
      ['panel-6-clone-1', 'error'],
      ['panel-6', 'drawn'],
    ]);
    await expect(capturePanelRender(6, 'panel-6-clone-1')).resolves.toBe('data:image/png;base64,CC==');
    [dashboard, clone, editor].forEach((reporter) => reporter.dispose());
  });

  it('keeps the paused flag and the data shape across reports', () => {
    const reporter = registerPanelRenderReporter(11, 'custom-panel');
    reporter.setPaused(true);
    reporter.setData({ frames: [{ refId: 'A', length: 1, fields: [] }] });
    reporter.report({ state: 'drawn', final: true });
    expect(getPanelRenderStatus(11)).toEqual(expect.objectContaining({ state: 'drawn', paused: true }));
    expect(getPanelRenderData(11)).toEqual({ frames: [{ refId: 'A', length: 1, fields: [] }] });

    reporter.setPaused(false);
    expect(getPanelRenderStatus(11)).not.toHaveProperty('paused');
    reporter.dispose();
  });
});
