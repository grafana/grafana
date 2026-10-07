import { registerPanelRenderReporter, type PanelRenderReporter } from 'app/features/panel/panelRenderStatus';

import type { DashboardScene } from '../../scene/DashboardScene';

import { getPanelRenderStatusCommand } from './getPanelRenderStatus';
import { MAX_RENDER_STATUS_IMAGE_CHARS } from './schemas';

jest.mock('../../utils/utils-panels', () => ({
  getPanelIdForVizPanel: (panel: { state: { id: number } }) => panel.state.id,
}));

const mockFocusVizPanel = jest.fn();
jest.mock('../../utils/focusPanel', () => ({
  focusVizPanel: (...args: unknown[]) => mockFocusVizPanel(...args),
}));

function buildScene(panelIds: number[], pluginId = 'timeseries', code = ''): DashboardScene {
  const panels = panelIds.map((id) => ({ state: { id, pluginId, options: { code } } }));
  return {
    state: { body: { getVizPanels: () => panels } },
    serializer: { getElementIdForPanel: (id: number) => `panel-${id}` },
  } as unknown as DashboardScene;
}

describe('GET_PANEL_RENDER_STATUS', () => {
  let reporters: PanelRenderReporter[] = [];
  const register = (panelId: number) => {
    const reporter = registerPanelRenderReporter(panelId, 'custom-panel');
    reporters.push(reporter);
    return reporter;
  };
  const registerPanelRenderReporterFor = (panelId: number, instanceKey: string) => {
    const reporter = registerPanelRenderReporter(panelId, 'custom-panel', Date.now, instanceKey);
    reporters.push(reporter);
    return reporter;
  };

  afterEach(() => {
    reporters.forEach((reporter) => reporter.dispose());
    reporters = [];
  });

  const run = (payload: Record<string, unknown>, scene: DashboardScene) =>
    getPanelRenderStatusCommand.handler(getPanelRenderStatusCommand.payloadSchema.parse(payload), { scene });

  it('is a read-only command whose payload accepts an empty object', () => {
    expect(getPanelRenderStatusCommand.readOnly).toBe(true);
    expect(getPanelRenderStatusCommand.payloadSchema.safeParse({}).success).toBe(true);
  });

  it('returns the status of every reporting panel on the dashboard, keyed by element', async () => {
    register(2).report({
      state: 'error',
      final: true,
      dataState: 'Done',
      digest: 'abcd1234',
      error: { kind: 'runtime', message: 'TypeError: x is undefined' },
    });
    // Reporting, but not on this dashboard.
    register(99).report({ state: 'drawn', final: true });

    const result = await run({}, buildScene([1, 2]));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      panels: [
        expect.objectContaining({
          element: 'panel-2',
          panelId: 2,
          pluginId: 'custom-panel',
          state: 'error',
          final: true,
          digest: 'abcd1234',
          error: { kind: 'runtime', message: 'TypeError: x is undefined' },
          ageMs: expect.any(Number),
        }),
      ],
    });
    expect(result.warnings).toBeUndefined();
  });

  it('names requested panels that are missing or do not report', async () => {
    register(2).report({ state: 'drawn', final: true });
    const result = await run({ elements: ['panel-1', 'panel-2', 'panel-8'] }, buildScene([1, 2]));
    expect((result.data as { panels: unknown[] }).panels).toHaveLength(1);
    expect(result.warnings).toEqual([
      'Not on this dashboard: panel-8.',
      'These panels do not report a draw status (only Custom panels do): panel-1.',
    ]);
  });

  it('adds a capture of the drawing, or why there is none, when includeImage is set', async () => {
    const captured = register(2);
    captured.report({ state: 'drawn', final: true });
    captured.setCapture(() => Promise.resolve('data:image/png;base64,AA=='));
    const failing = register(3);
    failing.report({ state: 'drawn', final: true });
    failing.setCapture(() => Promise.reject(new Error('The browser could not rasterize the drawing.')));
    register(4).report({ state: 'pending', final: false });

    const result = await run({ includeImage: true }, buildScene([2, 3, 4]));
    const panels = (result.data as { panels: Array<Record<string, unknown>> }).panels;
    expect(panels.map((entry) => [entry.element, entry.image, entry.imageError])).toEqual([
      ['panel-2', 'data:image/png;base64,AA==', undefined],
      ['panel-3', undefined, 'The browser could not rasterize the drawing.'],
      ['panel-4', undefined, 'This panel cannot capture its drawing.'],
    ]);
  });

  it('measures the layout only when includeLayout is set, or says why there is none', async () => {
    const layout = {
      width: 400,
      height: 300,
      overflowing: { count: 0, samples: [] },
      clippedText: { count: 1, samples: [{ element: 'div.card', text: 'Long label', visible: 0.5, ellipsis: false }] },
      overlaps: { count: 0, samples: [] },
      inspected: 4,
      truncated: false,
      durationMs: 0.3,
    };
    const measured = register(2);
    measured.report({ state: 'drawn', final: true });
    const measure = jest.fn(() => Promise.resolve(layout));
    measured.setMeasureLayout(measure);
    const failing = register(3);
    failing.report({ state: 'drawn', final: true });
    failing.setMeasureLayout(() => Promise.reject(new Error('The panel frame is not running.')));
    register(4).report({ state: 'pending', final: false });

    const plain = await run({}, buildScene([2]));
    expect((plain.data as { panels: Array<Record<string, unknown>> }).panels[0]).not.toHaveProperty('layout');
    expect(measure).not.toHaveBeenCalled();

    const result = await run({ includeLayout: true }, buildScene([2, 3, 4]));
    const panels = (result.data as { panels: Array<Record<string, unknown>> }).panels;
    expect(panels.map((entry) => [entry.element, entry.layout, entry.layoutError])).toEqual([
      ['panel-2', layout, undefined],
      ['panel-3', undefined, 'The panel frame is not running.'],
      ['panel-4', undefined, 'This panel cannot measure its layout.'],
    ]);
  });

  it('marks a Custom panel that is not rendered as not-mounted instead of a panel that does not report', async () => {
    const result = await run({ elements: ['panel-5'] }, buildScene([5], 'custom-panel', 'panel.onRender(() => {})'));
    expect((result.data as { panels: unknown[] }).panels).toEqual([
      expect.objectContaining({ element: 'panel-5', state: 'not-mounted', reason: 'not-rendered', final: false }),
    ]);
    expect(result.warnings).toEqual([
      'These Custom panels are not rendered right now, so they have not drawn: panel-5. Pass reveal with one of them to bring it into view.',
    ]);
  });

  it('returns one entry per repeat clone', async () => {
    registerPanelRenderReporterFor(6, 'panel-6').report({ state: 'drawn', final: true });
    registerPanelRenderReporterFor(6, 'panel-6-clone-1').report({
      state: 'error',
      final: true,
      error: { kind: 'runtime', message: 'boom' },
    });
    const result = await run({}, buildScene([6]));
    const panels = (result.data as { panels: Array<Record<string, unknown>> }).panels;
    expect(panels.map((entry) => [entry.element, entry.instanceKey, entry.state])).toEqual([
      ['panel-6', 'panel-6', 'drawn'],
      ['panel-6', 'panel-6-clone-1', 'error'],
    ]);
  });

  it('adds the data shape when includeData is set', async () => {
    const reporter = register(2);
    reporter.setData({ frames: [{ refId: 'A', length: 2, fields: [] }] });
    const result = await run({ includeData: true }, buildScene([2]));
    expect((result.data as { panels: Array<Record<string, unknown>> }).panels[0].data).toEqual({
      frames: [{ refId: 'A', length: 2, fields: [] }],
    });
  });

  it('reveals exactly one panel and waits for its draw to settle', async () => {
    const reporter = register(2);
    setTimeout(() => reporter.report({ state: 'drawn', final: true }), 50);
    const scene = buildScene([2], 'custom-panel', 'panel.onRender(() => {})');

    const result = await run({ elements: ['panel-2'], reveal: true, waitMs: 2000 }, scene);

    expect(mockFocusVizPanel).toHaveBeenCalledTimes(1);
    expect((result.data as { panels: Array<Record<string, unknown>> }).panels[0].state).toBe('drawn');
    const refused = await run({ reveal: true }, scene);
    expect(refused.success).toBe(false);
  });

  it('stops adding images once the response reaches its image budget', async () => {
    const big = `data:image/png;base64,${'A'.repeat(MAX_RENDER_STATUS_IMAGE_CHARS - 100)}`;
    for (const id of [2, 3]) {
      const reporter = register(id);
      reporter.report({ state: 'drawn', final: true });
      reporter.setCapture(() => Promise.resolve(big));
    }
    const result = await run({ includeImage: true }, buildScene([2, 3]));
    const panels = (result.data as { panels: Array<Record<string, unknown>> }).panels;
    expect(panels[0].image).toBe(big);
    expect(panels[1].image).toBeUndefined();
    expect(panels[1].imageError).toMatch(/size limit/);
  });
});
