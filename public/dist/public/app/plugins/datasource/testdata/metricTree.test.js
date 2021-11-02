import { queryMetricTree } from './metricTree';
describe('MetricTree', function () {
    it('queryMetric tree return right tree nodes', function () {
        var nodes = queryMetricTree('*');
        expect(nodes[0].children[0].name).toBe('AA');
        expect(nodes[0].children[1].name).toBe('AB');
    });
    it('queryMetric tree return right tree nodes', function () {
        var nodes = queryMetricTree('A.AB.ABC.*');
        expect(nodes[0].name).toBe('ABCA');
    });
    it('queryMetric tree supports glob paths', function () {
        var nodes = queryMetricTree('A.{AB,AC}.*').map(function (i) { return i.name; });
        expect(nodes).toEqual(['ABA', 'ABB', 'ABC', 'ACA', 'ACB', 'ACC']);
    });
    it('queryMetric tree supports wildcard matching', function () {
        var nodes = queryMetricTree('A.AB.AB*').map(function (i) { return i.name; });
        expect(nodes).toEqual(['ABA', 'ABB', 'ABC']);
    });
});
//# sourceMappingURL=metricTree.test.js.map