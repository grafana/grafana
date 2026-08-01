import { panelFromAssistantArgs } from './panelFromAssistantArgs';

describe('panelFromAssistantArgs', () => {
  it('builds a panel from assistant-style arguments', () => {
    const panel = panelFromAssistantArgs({
      title: 'Error rate',
      vizType: 'stat',
      datasourceUid: 'prom-1',
      datasourceType: 'prometheus',
      queries: [{ expr: 'rate(errors_total[5m])' }, { refId: 'X', expr: 'up' }],
    });

    expect(panel.kind).toBe('Panel');
    expect(panel.spec.title).toBe('Error rate');
    expect(panel.spec.subtitle).toBe('Added by Assistant');
    expect(panel.spec.vizConfig.group).toBe('stat');

    const queries = panel.spec.data.spec.queries;
    expect(queries).toHaveLength(2);
    expect(queries[0].spec.refId).toBe('A');
    expect(queries[0].spec.query.group).toBe('prometheus');
    expect(queries[0].spec.query.datasource?.name).toBe('prom-1');
    expect(queries[0].spec.query.spec.expr).toBe('rate(errors_total[5m])');
    expect(queries[1].spec.refId).toBe('X');
  });

  it('applies defaults for minimal arguments', () => {
    const panel = panelFromAssistantArgs({});
    expect(panel.spec.vizConfig.group).toBe('timeseries');
    expect(panel.spec.title).toBe('Assistant panel');
    expect(panel.spec.data.spec.queries).toHaveLength(0);
  });
});
