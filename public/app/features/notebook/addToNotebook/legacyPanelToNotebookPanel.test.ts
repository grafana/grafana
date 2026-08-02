import { legacyPanelToNotebookPanel } from './legacyPanelToNotebookPanel';

describe('legacyPanelToNotebookPanel', () => {
  it('converts targets, datasource and viz type to the notebook panel shape', () => {
    const panel = {
      type: 'timeseries',
      title: 'Explore result',
      datasource: { type: 'prometheus', uid: 'prom-1' },
      targets: [
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: 'rate(http_requests_total[5m])', hide: true },
      ],
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture matching the loose legacy panel shape
    const result = legacyPanelToNotebookPanel(panel as never, { subtitle: 'From Explore' });

    expect(result.kind).toBe('Panel');
    expect(result.spec.title).toBe('Explore result');
    expect(result.spec.subtitle).toBe('From Explore');
    expect(result.spec.vizConfig.group).toBe('timeseries');

    const queries = result.spec.data.spec.queries;
    expect(queries).toHaveLength(2);
    expect(queries[0].spec.refId).toBe('A');
    expect(queries[0].spec.hidden).toBe(false);
    expect(queries[0].spec.query.group).toBe('prometheus');
    expect(queries[0].spec.query.datasource?.name).toBe('prom-1');
    expect(queries[0].spec.query.spec.expr).toBe('up');
    expect(queries[1].spec.hidden).toBe(true);
  });

  it('falls back to empty defaults for minimal panels', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture matching the loose legacy panel shape
    const result = legacyPanelToNotebookPanel({ type: 'table' } as never);

    expect(result.spec.title).toBe('');
    expect(result.spec.data.spec.queries).toHaveLength(0);
    expect(result.spec.vizConfig.spec.fieldConfig).toEqual({ defaults: {}, overrides: [] });
  });
});
