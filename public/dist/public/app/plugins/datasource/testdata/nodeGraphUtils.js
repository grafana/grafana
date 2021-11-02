import { __assign, __values } from "tslib";
import { ArrayVector, FieldColorModeId, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames, } from '@grafana/data';
import { nodes, edges } from './testData/serviceMapResponse';
export function generateRandomNodes(count) {
    var _a, _b, e_1, _c, e_2, _d;
    if (count === void 0) { count = 10; }
    var nodes = [];
    var root = {
        id: '0',
        title: 'root',
        subTitle: 'client',
        success: 1,
        error: 0,
        stat1: Math.random(),
        stat2: Math.random(),
        edges: [],
    };
    nodes.push(root);
    var nodesWithoutMaxEdges = [root];
    var maxEdges = 3;
    for (var i = 1; i < count; i++) {
        var node = makeRandomNode(i);
        nodes.push(node);
        var sourceIndex = Math.floor(Math.random() * Math.floor(nodesWithoutMaxEdges.length - 1));
        var source = nodesWithoutMaxEdges[sourceIndex];
        source.edges.push(node.id);
        if (source.edges.length >= maxEdges) {
            nodesWithoutMaxEdges.splice(sourceIndex, 1);
        }
        nodesWithoutMaxEdges.push(node);
    }
    // Add some random edges to create possible cycle
    var additionalEdges = Math.floor(count / 2);
    for (var i = 0; i <= additionalEdges; i++) {
        var sourceIndex = Math.floor(Math.random() * Math.floor(nodes.length - 1));
        var targetIndex = Math.floor(Math.random() * Math.floor(nodes.length - 1));
        if (sourceIndex === targetIndex || nodes[sourceIndex].id === '0' || nodes[sourceIndex].id === '0') {
            continue;
        }
        nodes[sourceIndex].edges.push(nodes[sourceIndex].id);
    }
    var nodeFields = (_a = {},
        _a[NodeGraphDataFrameFieldNames.id] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a[NodeGraphDataFrameFieldNames.title] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a[NodeGraphDataFrameFieldNames.subTitle] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a[NodeGraphDataFrameFieldNames.mainStat] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { displayName: 'Transactions per second' },
        },
        _a[NodeGraphDataFrameFieldNames.secondaryStat] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { displayName: 'Average duration' },
        },
        _a[NodeGraphDataFrameFieldNames.arc + 'success'] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { color: { fixedColor: 'green', mode: FieldColorModeId.Fixed }, displayName: 'Success' },
        },
        _a[NodeGraphDataFrameFieldNames.arc + 'errors'] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { color: { fixedColor: 'red', mode: FieldColorModeId.Fixed }, displayName: 'Errors' },
        },
        _a);
    var nodeFrame = new MutableDataFrame({
        name: 'nodes',
        fields: Object.keys(nodeFields).map(function (key) { return (__assign(__assign({}, nodeFields[key]), { name: key })); }),
        meta: { preferredVisualisationType: 'nodeGraph' },
    });
    var edgeFields = (_b = {},
        _b[NodeGraphDataFrameFieldNames.id] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _b[NodeGraphDataFrameFieldNames.source] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _b[NodeGraphDataFrameFieldNames.target] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _b);
    var edgesFrame = new MutableDataFrame({
        name: 'edges',
        fields: Object.keys(edgeFields).map(function (key) { return (__assign(__assign({}, edgeFields[key]), { name: key })); }),
        meta: { preferredVisualisationType: 'nodeGraph' },
    });
    var edgesSet = new Set();
    try {
        for (var nodes_1 = __values(nodes), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
            var node = nodes_1_1.value;
            nodeFields.id.values.add(node.id);
            nodeFields.title.values.add(node.title);
            nodeFields.subTitle.values.add(node.subTitle);
            nodeFields.mainStat.values.add(node.stat1);
            nodeFields.secondaryStat.values.add(node.stat2);
            nodeFields.arc__success.values.add(node.success);
            nodeFields.arc__errors.values.add(node.error);
            try {
                for (var _e = (e_2 = void 0, __values(node.edges)), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var edge = _f.value;
                    var id = node.id + "--" + edge;
                    // We can have duplicate edges when we added some more by random
                    if (edgesSet.has(id)) {
                        continue;
                    }
                    edgesSet.add(id);
                    edgeFields.id.values.add(node.id + "--" + edge);
                    edgeFields.source.values.add(node.id);
                    edgeFields.target.values.add(edge);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_d = _e.return)) _d.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (nodes_1_1 && !nodes_1_1.done && (_c = nodes_1.return)) _c.call(nodes_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return [nodeFrame, edgesFrame];
}
function makeRandomNode(index) {
    var success = Math.random();
    var error = 1 - success;
    return {
        id: index.toString(),
        title: "service:" + index,
        subTitle: 'service',
        success: success,
        error: error,
        stat1: Math.random(),
        stat2: Math.random(),
        edges: [],
    };
}
export function savedNodesResponse() {
    return [new MutableDataFrame(nodes), new MutableDataFrame(edges)];
}
//# sourceMappingURL=nodeGraphUtils.js.map