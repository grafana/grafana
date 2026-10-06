import {
  capturePanelRender,
  getPanelRenderStatus,
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
});
