import { VisualQueryEngine } from './engine';

describe('VisualQueryEngine', () => {
  const engine = new VisualQueryEngine();

  it('Can render simple query with metric only', () => {
    expect(
      engine.renderQuery({
        metric: 'my_totals',
        labels: [],
        operations: [],
      })
    ).toBe('my_totals');
  });

  it('Can render simple query with label filters', () => {
    expect(
      engine.renderQuery({
        metric: 'my_totals',
        labels: [
          { label: 'cluster', op: '=', value: 'us-east' },
          { label: 'job', op: '=~', value: 'abc' },
        ],
        operations: [],
      })
    ).toBe('my_totals{cluster="us-east", job=~"abc"}');
  });
});
