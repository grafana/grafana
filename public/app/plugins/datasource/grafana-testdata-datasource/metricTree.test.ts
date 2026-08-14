import { queryMetricTree } from './metricTree';

describe('MetricTree', () => {
  it('queryMetric tree return right tree nodes', () => {
    const nodes = queryMetricTree('*');
    expect(nodes[0].children[0].name).toBe('AA');
    expect(nodes[0].children[1].name).toBe('AB');
  });

  it('queryMetric tree return right tree nodes', () => {
    const nodes = queryMetricTree('A.AB.ABC.*');
    expect(nodes[0].name).toBe('ABCA');
  });

  it('queryMetric tree supports glob paths', () => {
    const nodes = queryMetricTree('A.{AB,AC}.*').map((i) => i.name);
    expect(nodes).toEqual(expect.arrayContaining(['ABA', 'ABB', 'ABC', 'ACA', 'ACB', 'ACC']));
  });

  it('queryMetric tree supports wildcard matching', () => {
    const nodes = queryMetricTree('A.AB.AB*').map((i) => i.name);
    expect(nodes).toEqual(expect.arrayContaining(['ABA', 'ABB', 'ABC']));
  });
});
