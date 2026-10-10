import { changedPanelKeys, diffDashboardSpecs } from './specDiff';

const panel = (id: number, title: string, expr = 'up') => ({
  kind: 'Panel',
  spec: {
    id,
    title,
    data: { kind: 'QueryGroup', spec: { queries: [{ expr }] } },
    vizConfig: { kind: 'VizConfig', group: 'timeseries' },
  },
});

describe('diffDashboardSpecs', () => {
  it('reports added, edited, and removed v2 panels with their scene keys', () => {
    const base = {
      title: 'API',
      elements: { a: panel(1, 'Rate'), b: panel(2, 'Errors') },
      layout: { kind: 'GridLayout' },
    };
    const fork = {
      title: 'API',
      elements: { a: panel(1, 'Rate', 'sum(up)'), c: panel(3, 'CPU') },
      layout: { kind: 'GridLayout' },
    };

    const changes = diffDashboardSpecs(base, fork);

    expect(changes).toEqual([
      { type: 'edited', target: 'panel', name: 'Rate', parts: ['queries'], panelKey: 'panel-1' },
      { type: 'added', target: 'panel', name: 'CPU', panelKey: 'panel-3' },
      { type: 'removed', target: 'panel', name: 'Errors' },
    ]);
    expect([...changedPanelKeys(changes)]).toEqual([
      ['panel-1', 'edited'],
      ['panel-3', 'added'],
    ]);
  });

  it('treats absent and empty values as the same, so a converted dashboard has no phantom edits', () => {
    const base = { title: 'API', elements: { a: panel(1, 'Rate') }, layout: { kind: 'GridLayout' } };
    const converted = {
      title: 'API',
      tags: [],
      elements: { a: { ...panel(1, 'Rate'), spec: { ...panel(1, 'Rate').spec, description: '', links: [] } } },
      layout: { kind: 'GridLayout' },
    };

    expect(diffDashboardSpecs(base, converted)).toEqual([]);
  });

  it('diffs classic dashboards and treats moves as a layout change', () => {
    const base = { panels: [{ id: 1, type: 'stat', title: 'Up', gridPos: { x: 0, y: 0, w: 6, h: 4 } }] };
    const fork = { panels: [{ id: 1, type: 'stat', title: 'Up', gridPos: { x: 6, y: 0, w: 6, h: 4 } }] };

    expect(diffDashboardSpecs(base, fork)).toEqual([{ type: 'edited', target: 'layout', name: 'layout' }]);
  });
});
