import { __awaiter } from "tslib";
import { FieldType, createDataFrame } from '@grafana/data';
import { findConnectedNodesForEdge, findConnectedNodesForNode, getEdgeFields, getNodeFields, getNodeGraphDataFrames, makeEdgesDataFrame, makeNodesDataFrame, processNodes, } from './utils';
describe('processNodes', () => {
    it('handles empty args', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(processNodes(undefined, undefined)).toEqual({ nodes: [], edges: [] });
    }));
    it('returns proper nodes and edges', () => __awaiter(void 0, void 0, void 0, function* () {
        const { nodes, edges, legend } = processNodes(makeNodesDataFrame(3), makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '0', target: '2' },
            { source: '1', target: '2' },
        ]));
        expect(nodes).toEqual([
            makeNodeDatum(),
            makeNodeDatum({ dataFrameRowIndex: 1, id: '1', incoming: 1, title: 'service:1' }),
            makeNodeDatum({ dataFrameRowIndex: 2, id: '2', incoming: 2, title: 'service:2' }),
        ]);
        expect(edges).toEqual([makeEdgeDatum('0--1', 0), makeEdgeDatum('0--2', 1), makeEdgeDatum('1--2', 2)]);
        expect(legend).toEqual([
            {
                color: 'green',
                name: 'arc__success',
            },
            {
                color: 'red',
                name: 'arc__errors',
            },
        ]);
    }));
    it('returns nodes just from edges dataframe', () => {
        var _a, _b;
        const { nodes, edges } = processNodes(undefined, makeEdgesDataFrame([
            { source: '0', target: '1', mainstat: 1, secondarystat: 1 },
            { source: '0', target: '2', mainstat: 1, secondarystat: 1 },
            { source: '1', target: '2', mainstat: 1, secondarystat: 1 },
        ]));
        expect(nodes).toEqual([
            expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 0, title: '0' })),
            expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 1, id: '1', incoming: 1, title: '1' })),
            expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 2, id: '2', incoming: 2, title: '2' })),
        ]);
        expect((_a = nodes[0].mainStat) === null || _a === void 0 ? void 0 : _a.values).toEqual([undefined, 1, 2]);
        expect((_b = nodes[0].secondaryStat) === null || _b === void 0 ? void 0 : _b.values).toEqual([undefined, 1, 2]);
        expect(nodes[0].mainStat).toEqual(nodes[1].mainStat);
        expect(nodes[0].mainStat).toEqual(nodes[2].mainStat);
        expect(nodes[0].secondaryStat).toEqual(nodes[1].secondaryStat);
        expect(nodes[0].secondaryStat).toEqual(nodes[2].secondaryStat);
        expect(edges).toEqual([
            makeEdgeDatum('0--1', 0, '1.00', '1.00'),
            makeEdgeDatum('0--2', 1, '1.00', '1.00'),
            makeEdgeDatum('1--2', 2, '1.00', '1.00'),
        ]);
    });
    it('detects dataframes correctly', () => {
        const validFrames = [
            createDataFrame({
                refId: 'hasPreferredVisualisationType',
                fields: [],
                meta: {
                    preferredVisualisationType: 'nodeGraph',
                },
            }),
            createDataFrame({
                refId: 'hasName',
                fields: [],
                name: 'nodes',
            }),
            createDataFrame({
                refId: 'nodes',
                fields: [],
            }),
            createDataFrame({
                refId: 'hasValidNodesShape',
                fields: [{ name: 'id', type: FieldType.string }],
            }),
            createDataFrame({
                refId: 'hasValidEdgesShape',
                fields: [
                    { name: 'id', type: FieldType.string },
                    { name: 'source', type: FieldType.string },
                    { name: 'target', type: FieldType.string },
                ],
            }),
        ];
        const invalidFrames = [
            createDataFrame({
                refId: 'invalidData',
                fields: [],
            }),
        ];
        const frames = [...validFrames, ...invalidFrames];
        const nodeGraphFrames = getNodeGraphDataFrames(frames);
        expect(nodeGraphFrames.length).toBe(5);
        expect(nodeGraphFrames).toEqual(validFrames);
    });
    it('getting fields is case insensitive', () => {
        const nodeFrame = createDataFrame({
            refId: 'nodes',
            fields: [
                { name: 'id', type: FieldType.string, values: ['id'] },
                { name: 'title', type: FieldType.string, values: ['title'] },
                { name: 'SUBTITLE', type: FieldType.string, values: ['subTitle'] },
                { name: 'mainstat', type: FieldType.string, values: ['mainStat'] },
                { name: 'seconDarysTat', type: FieldType.string, values: ['secondaryStat'] },
                { name: 'nodeRadius', type: FieldType.number, values: [20] },
            ],
        });
        const nodeFields = getNodeFields(nodeFrame);
        expect(nodeFields.id).toBeDefined();
        expect(nodeFields.title).toBeDefined();
        expect(nodeFields.subTitle).toBeDefined();
        expect(nodeFields.mainStat).toBeDefined();
        expect(nodeFields.secondaryStat).toBeDefined();
        const edgeFrame = createDataFrame({
            refId: 'nodes',
            fields: [
                { name: 'id', type: FieldType.string, values: ['id'] },
                { name: 'source', type: FieldType.string, values: ['title'] },
                { name: 'TARGET', type: FieldType.string, values: ['subTitle'] },
                { name: 'mainstat', type: FieldType.string, values: ['mainStat'] },
                { name: 'secondarystat', type: FieldType.string, values: ['secondaryStat'] },
            ],
        });
        const edgeFields = getEdgeFields(edgeFrame);
        expect(edgeFields.id).toBeDefined();
        expect(edgeFields.source).toBeDefined();
        expect(edgeFields.target).toBeDefined();
        expect(edgeFields.mainStat).toBeDefined();
        expect(edgeFields.secondaryStat).toBeDefined();
    });
    it('interpolates panel options correctly', () => {
        var _a, _b, _c, _d, _e, _f, _g;
        const frames = [
            createDataFrame({
                refId: 'nodes',
                fields: [
                    { name: 'id', type: FieldType.string },
                    { name: 'mainStat', type: FieldType.string },
                    { name: 'secondaryStat', type: FieldType.string },
                    { name: 'arc__primary', type: FieldType.string },
                    { name: 'arc__secondary', type: FieldType.string },
                    { name: 'arc__tertiary', type: FieldType.string },
                ],
            }),
            createDataFrame({
                refId: 'edges',
                fields: [
                    { name: 'id', type: FieldType.string },
                    { name: 'source', type: FieldType.string },
                    { name: 'target', type: FieldType.string },
                    { name: 'mainStat', type: FieldType.string },
                    { name: 'secondaryStat', type: FieldType.string },
                ],
            }),
        ];
        const panelOptions = {
            nodes: {
                mainStatUnit: 'r/min',
                secondaryStatUnit: 'ms/r',
                arcs: [
                    { field: 'arc__primary', color: 'red' },
                    { field: 'arc__secondary', color: 'yellow' },
                    { field: 'arc__tertiary', color: '#dd40ec' },
                ],
            },
            edges: {
                mainStatUnit: 'r/sec',
                secondaryStatUnit: 'ft^2',
            },
        };
        const nodeGraphFrames = getNodeGraphDataFrames(frames, panelOptions);
        expect(nodeGraphFrames).toHaveLength(2);
        const nodesFrame = nodeGraphFrames.find((f) => f.refId === 'nodes');
        expect(nodesFrame).toBeDefined();
        expect((_a = nodesFrame === null || nodesFrame === void 0 ? void 0 : nodesFrame.fields.find((f) => f.name === 'mainStat')) === null || _a === void 0 ? void 0 : _a.config).toEqual({ unit: 'r/min' });
        expect((_b = nodesFrame === null || nodesFrame === void 0 ? void 0 : nodesFrame.fields.find((f) => f.name === 'secondaryStat')) === null || _b === void 0 ? void 0 : _b.config).toEqual({ unit: 'ms/r' });
        expect((_c = nodesFrame === null || nodesFrame === void 0 ? void 0 : nodesFrame.fields.find((f) => f.name === 'arc__primary')) === null || _c === void 0 ? void 0 : _c.config).toEqual({
            color: { mode: 'fixed', fixedColor: 'red' },
        });
        expect((_d = nodesFrame === null || nodesFrame === void 0 ? void 0 : nodesFrame.fields.find((f) => f.name === 'arc__secondary')) === null || _d === void 0 ? void 0 : _d.config).toEqual({
            color: { mode: 'fixed', fixedColor: 'yellow' },
        });
        expect((_e = nodesFrame === null || nodesFrame === void 0 ? void 0 : nodesFrame.fields.find((f) => f.name === 'arc__tertiary')) === null || _e === void 0 ? void 0 : _e.config).toEqual({
            color: { mode: 'fixed', fixedColor: '#dd40ec' },
        });
        const edgesFrame = nodeGraphFrames.find((f) => f.refId === 'edges');
        expect(edgesFrame).toBeDefined();
        expect((_f = edgesFrame === null || edgesFrame === void 0 ? void 0 : edgesFrame.fields.find((f) => f.name === 'mainStat')) === null || _f === void 0 ? void 0 : _f.config).toEqual({ unit: 'r/sec' });
        expect((_g = edgesFrame === null || edgesFrame === void 0 ? void 0 : edgesFrame.fields.find((f) => f.name === 'secondaryStat')) === null || _g === void 0 ? void 0 : _g.config).toEqual({ unit: 'ft^2' });
    });
});
describe('finds connections', () => {
    it('finds connected nodes given an edge id', () => {
        const { nodes, edges } = processNodes(makeNodesDataFrame(3), makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '0', target: '2' },
            { source: '1', target: '2' },
        ]));
        const linked = findConnectedNodesForEdge(nodes, edges, edges[0].id);
        expect(linked).toEqual(['0', '1']);
    });
    it('finds connected nodes given a node id', () => {
        const { nodes, edges } = processNodes(makeNodesDataFrame(4), makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '0', target: '2' },
            { source: '1', target: '2' },
        ]));
        const linked = findConnectedNodesForNode(nodes, edges, nodes[0].id);
        expect(linked).toEqual(['0', '1', '2']);
    });
});
function makeNodeDatum(options = {}) {
    const colorField = {
        config: {
            color: {
                mode: 'continuous-GrYlRd',
            },
        },
        index: 7,
        name: 'color',
        type: 'number',
        values: [0.5, 0.5, 0.5],
    };
    return Object.assign({ arcSections: [
            {
                config: {
                    color: {
                        fixedColor: 'green',
                    },
                },
                name: 'arc__success',
                type: 'number',
                values: [0.5, 0.5, 0.5],
            },
            {
                config: {
                    color: {
                        fixedColor: 'red',
                    },
                },
                name: 'arc__errors',
                type: 'number',
                values: [0.5, 0.5, 0.5],
            },
        ], color: colorField, dataFrameRowIndex: 0, id: '0', incoming: 0, mainStat: {
            config: {},
            index: 3,
            name: 'mainstat',
            type: 'number',
            values: [0.1, 0.1, 0.1],
        }, secondaryStat: {
            config: {},
            index: 4,
            name: 'secondarystat',
            type: 'number',
            values: [2, 2, 2],
        }, subTitle: 'service', title: 'service:0', icon: 'database', nodeRadius: {
            config: {},
            index: 9,
            name: 'noderadius',
            type: 'number',
            values: [40, 40, 40],
        } }, options);
}
function makeEdgeDatum(id, index, mainStat = '', secondaryStat = '') {
    return {
        dataFrameRowIndex: index,
        id,
        mainStat,
        secondaryStat,
        source: id.split('--')[0],
        target: id.split('--')[1],
        sourceNodeRadius: 40,
        targetNodeRadius: 40,
    };
}
function makeNodeFromEdgeDatum(options = {}) {
    return Object.assign({ arcSections: [], dataFrameRowIndex: 0, id: '0', incoming: 0, subTitle: '', title: 'service:0' }, options);
}
//# sourceMappingURL=utils.test.js.map