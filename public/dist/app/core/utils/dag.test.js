import { Graph } from './dag';
describe('Directed acyclic graph', function () {
    describe('Given a graph with nodes with different links in between them', function () {
        var dag = new Graph();
        var nodeA = dag.createNode('A');
        var nodeB = dag.createNode('B');
        var nodeC = dag.createNode('C');
        var nodeD = dag.createNode('D');
        var nodeE = dag.createNode('E');
        var nodeF = dag.createNode('F');
        var nodeG = dag.createNode('G');
        var nodeH = dag.createNode('H');
        var nodeI = dag.createNode('I');
        dag.link([nodeB, nodeC, nodeD, nodeE, nodeF, nodeG, nodeH], nodeA);
        dag.link([nodeC, nodeD, nodeE, nodeF, nodeI], nodeB);
        dag.link([nodeD, nodeE, nodeF, nodeG], nodeC);
        dag.link([nodeE, nodeF], nodeD);
        dag.link([nodeF, nodeG], nodeE);
        //printGraph(dag);
        it('nodes in graph should have expected edges', function () {
            expect(nodeA.inputEdges).toHaveLength(7);
            expect(nodeA.outputEdges).toHaveLength(0);
            expect(nodeA.edges).toHaveLength(7);
            expect(nodeB.inputEdges).toHaveLength(5);
            expect(nodeB.outputEdges).toHaveLength(1);
            expect(nodeB.edges).toHaveLength(6);
            expect(nodeC.inputEdges).toHaveLength(4);
            expect(nodeC.outputEdges).toHaveLength(2);
            expect(nodeC.edges).toHaveLength(6);
            expect(nodeD.inputEdges).toHaveLength(2);
            expect(nodeD.outputEdges).toHaveLength(3);
            expect(nodeD.edges).toHaveLength(5);
            expect(nodeE.inputEdges).toHaveLength(2);
            expect(nodeE.outputEdges).toHaveLength(4);
            expect(nodeE.edges).toHaveLength(6);
            expect(nodeF.inputEdges).toHaveLength(0);
            expect(nodeF.outputEdges).toHaveLength(5);
            expect(nodeF.edges).toHaveLength(5);
            expect(nodeG.inputEdges).toHaveLength(0);
            expect(nodeG.outputEdges).toHaveLength(3);
            expect(nodeG.edges).toHaveLength(3);
            expect(nodeH.inputEdges).toHaveLength(0);
            expect(nodeH.outputEdges).toHaveLength(1);
            expect(nodeH.edges).toHaveLength(1);
            expect(nodeI.inputEdges).toHaveLength(0);
            expect(nodeI.outputEdges).toHaveLength(1);
            expect(nodeI.edges).toHaveLength(1);
            expect(nodeA.getEdgeFrom(nodeB)).not.toBeUndefined();
            expect(nodeB.getEdgeTo(nodeA)).not.toBeUndefined();
        });
        it('when optimizing input edges for node A should return node B and H', function () {
            var actual = nodeA.getOptimizedInputEdges().map(function (e) { return e.inputNode; });
            expect(actual).toHaveLength(2);
            expect(actual).toEqual(expect.arrayContaining([nodeB, nodeH]));
        });
        it('when optimizing input edges for node B should return node C', function () {
            var actual = nodeB.getOptimizedInputEdges().map(function (e) { return e.inputNode; });
            expect(actual).toHaveLength(2);
            expect(actual).toEqual(expect.arrayContaining([nodeC, nodeI]));
        });
        it('when optimizing input edges for node C should return node D', function () {
            var actual = nodeC.getOptimizedInputEdges().map(function (e) { return e.inputNode; });
            expect(actual).toHaveLength(1);
            expect(actual).toEqual(expect.arrayContaining([nodeD]));
        });
        it('when optimizing input edges for node D should return node E', function () {
            var actual = nodeD.getOptimizedInputEdges().map(function (e) { return e.inputNode; });
            expect(actual).toHaveLength(1);
            expect(actual).toEqual(expect.arrayContaining([nodeE]));
        });
        it('when optimizing input edges for node E should return node F and G', function () {
            var actual = nodeE.getOptimizedInputEdges().map(function (e) { return e.inputNode; });
            expect(actual).toHaveLength(2);
            expect(actual).toEqual(expect.arrayContaining([nodeF, nodeG]));
        });
        it('when optimizing input edges for node F should return zero nodes', function () {
            var actual = nodeF.getOptimizedInputEdges();
            expect(actual).toHaveLength(0);
        });
        it('when optimizing input edges for node G should return zero nodes', function () {
            var actual = nodeG.getOptimizedInputEdges();
            expect(actual).toHaveLength(0);
        });
        it('when optimizing input edges for node H should return zero nodes', function () {
            var actual = nodeH.getOptimizedInputEdges();
            expect(actual).toHaveLength(0);
        });
        it('when linking non-existing input node with existing output node should throw error', function () {
            expect(function () {
                dag.link('non-existing', 'A');
            }).toThrowError("cannot link input node named non-existing since it doesn't exist in graph");
        });
        it('when linking existing input node with non-existing output node should throw error', function () {
            expect(function () {
                dag.link('A', 'non-existing');
            }).toThrowError("cannot link output node named non-existing since it doesn't exist in graph");
        });
    });
});
//# sourceMappingURL=dag.test.js.map