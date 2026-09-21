import { buildPanelHandoffPrompt } from './handoffPrompt';

describe('buildPanelHandoffPrompt', () => {
  const handoff = {
    resourceKind: 'dashboard' as const,
    resourceUid: 'abc123',
    panelId: 3,
    panelTitle: 'p95 latency',
    panelType: 'timeseries',
    from: 'now-6h',
    to: 'now',
  };

  it('names the panel, the resource and the window, and the tool that fetches it', () => {
    expect(buildPanelHandoffPrompt(handoff)).toBe(
      [
        'Show me the "p95 latency" panel (panel 3) from Grafana dashboard abc123, over now-6h to now.',
        '',
        'Call run_panel_query once with dashboardUid "abc123" and panelIds [3], start "now-6h", end "now". ' +
          'It returns every query the panel has, and rendering it draws the whole timeseries panel. ' +
          'Stop there: no summary of the values, no second chart, nothing rebuilt by hand.',
      ].join('\n')
    );
  });

  it('tells the agent to stop once it has rendered', () => {
    // Without this the agent treats a panel it thinks is incomplete as work to finish:
    // it re-queried, read files, ran jq and drew its own chart alongside the panel.
    const prompt = buildPanelHandoffPrompt(handoff);

    expect(prompt).toContain('Stop there: no summary of the values, no second chart, nothing rebuilt by hand.');
    expect(prompt).toContain('once');
  });

  it('reads as a request a person made, not as tool arguments', () => {
    // The agent displays this as the message it is answering, so indented argument
    // blocks show up in the transcript as machinery leaking out of the button.
    const lines = buildPanelHandoffPrompt(handoff).split('\n');

    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => line.startsWith('  '))).toEqual([]);
  });

  it('carries no url, because Cursor mis-parses embedded ones', () => {
    expect(buildPanelHandoffPrompt(handoff)).not.toMatch(/https?:\/\//);
  });

  it('keeps the range relative rather than resolving it', () => {
    // `now-6h` has to survive the handoff or the agent re-queries a frozen window.
    const prompt = buildPanelHandoffPrompt({ ...handoff, from: 'now-15m', to: 'now' });

    expect(prompt).toContain('start "now-15m"');
    expect(prompt).not.toMatch(/start "\d{10}/);
  });

  it('falls back to the panel id when the panel has no title', () => {
    expect(buildPanelHandoffPrompt({ ...handoff, panelTitle: undefined })).toContain(
      'Show me panel 3 from Grafana dashboard abc123'
    );
  });

  it('names the notebook resource and its uid key when the panel comes from one', () => {
    const prompt = buildPanelHandoffPrompt({ ...handoff, resourceKind: 'notebook', resourceUid: 'nb-7' });

    expect(prompt).toContain('from Grafana notebook nb-7');
    expect(prompt).toContain('notebookUid "nb-7"');
  });
});
