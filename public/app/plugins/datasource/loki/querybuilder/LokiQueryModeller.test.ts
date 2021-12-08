import { LokiQueryModeller } from './LokiQueryModeller';

describe('LokiQueryModeller', () => {
  const engine = new LokiQueryModeller();

  it('Can query with labels only', () => {
    expect(
      engine.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [],
      })
    ).toBe('{app="grafana"}');
  });

  it('Can query with labels and search', () => {
    expect(
      engine.renderQuery({
        search: 'error',
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [],
      })
    ).toBe('{app="grafana"} |= "error"');
  });

  it('Can query with pipeline operation json', () => {
    expect(
      engine.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'json', params: [] }],
      })
    ).toBe('{app="grafana"} | json');
  });

  it('Can query with pipeline operation logfmt', () => {
    expect(
      engine.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'logfmt', params: [] }],
      })
    ).toBe('{app="grafana"} | logfmt');
  });
});
