import { registerPanelRenderReporter, type PanelRenderReporter } from 'app/features/panel/panelRenderStatus';

import type { DashboardScene } from '../../scene/DashboardScene';

import { getPanelRenderStatusCommand } from './getPanelRenderStatus';

jest.mock('../../utils/utils-panels', () => ({
  getPanelIdForVizPanel: (panel: { state: { id: number } }) => panel.state.id,
}));

function buildScene(panelIds: number[]): DashboardScene {
  const panels = panelIds.map((id) => ({ state: { id } }));
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
});
