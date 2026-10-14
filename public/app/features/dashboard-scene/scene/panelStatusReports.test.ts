import { SceneFlexItem, SceneFlexLayout, VizPanel } from '@grafana/scenes';

import { getPanelStatusReport, setPanelStatusReport } from './panelStatusReports';

function buildPanel(options: Record<string, unknown> = { source: 'a' }, pluginId = 'custom-viz') {
  return new VizPanel({ key: 'panel-1', pluginId, options });
}

function mount(panel: VizPanel) {
  return new SceneFlexLayout({ children: [new SceneFlexItem({ body: panel })] });
}

describe('panelStatusReports', () => {
  it('returns the last report for the panel', () => {
    const panel = buildPanel();
    mount(panel);

    setPanelStatusReport(panel, { state: 'error', message: 'Draw failed', details: 'line 3' });
    expect(getPanelStatusReport(panel)).toEqual({
      report: { state: 'error', message: 'Draw failed', details: 'line 3' },
    });

    setPanelStatusReport(panel, { state: 'ok' });
    expect(getPanelStatusReport(panel)).toEqual({ report: { state: 'ok' } });
  });

  it('keeps the report when the panel is rebuilt with the same key and configuration', () => {
    const panel = buildPanel();
    const layout = mount(panel);
    setPanelStatusReport(panel, { state: 'error', message: 'Draw failed' });

    const rebuilt = buildPanel();
    layout.setState({ children: [new SceneFlexItem({ body: rebuilt })] });

    expect(getPanelStatusReport(rebuilt)).toEqual({ report: { state: 'error', message: 'Draw failed' } });
  });

  it('marks the report outdated once the options change', () => {
    const panel = buildPanel();
    mount(panel);
    setPanelStatusReport(panel, { state: 'error', message: 'Draw failed' });

    panel.setState({ options: { source: 'b' } });
    expect(getPanelStatusReport(panel)).toBe('outdated');

    setPanelStatusReport(panel, { state: 'ok' });
    expect(getPanelStatusReport(panel)).toEqual({ report: { state: 'ok' } });
  });

  it('ignores reports from another plugin or another dashboard', () => {
    const panel = buildPanel();
    mount(panel);
    setPanelStatusReport(panel, { state: 'error', message: 'Draw failed' });

    panel.setState({ pluginId: 'timeseries' });
    expect(getPanelStatusReport(panel)).toBeUndefined();

    const elsewhere = buildPanel();
    mount(elsewhere);
    expect(getPanelStatusReport(elsewhere)).toBeUndefined();
  });

  it('bounds the reported text', () => {
    const panel = buildPanel();
    mount(panel);
    setPanelStatusReport(panel, { state: 'error', message: 'x'.repeat(5000) });

    const lookup = getPanelStatusReport(panel);
    const message = lookup && lookup !== 'outdated' ? lookup.report.message : undefined;
    expect(message).toHaveLength(2001);
    expect(message?.endsWith('…')).toBe(true);
  });
});
