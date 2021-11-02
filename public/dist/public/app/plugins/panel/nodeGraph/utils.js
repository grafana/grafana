import { __assign, __values } from "tslib";
import { ArrayVector, FieldCache, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames, } from '@grafana/data';
/**
 * Makes line shorter while keeping the middle in he same place.
 */
export function shortenLine(line, length) {
    var vx = line.x2 - line.x1;
    var vy = line.y2 - line.y1;
    var mag = Math.sqrt(vx * vx + vy * vy);
    var ratio = Math.max((mag - length) / mag, 0);
    var vx2 = vx * ratio;
    var vy2 = vy * ratio;
    var xDiff = vx - vx2;
    var yDiff = vy - vy2;
    var newx1 = line.x1 + xDiff / 2;
    var newy1 = line.y1 + yDiff / 2;
    return {
        x1: newx1,
        y1: newy1,
        x2: newx1 + vx2,
        y2: newy1 + vy2,
    };
}
export function getNodeFields(nodes) {
    var fieldsCache = new FieldCache(nodes);
    return {
        id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id),
        title: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.title),
        subTitle: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.subTitle),
        mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat),
        secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat),
        arc: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.arc),
        details: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.detail),
        color: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.color),
    };
}
export function getEdgeFields(edges) {
    var fieldsCache = new FieldCache(edges);
    return {
        id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id),
        source: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source),
        target: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.target),
        mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat),
        secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat),
        details: findFieldsByPrefix(edges, NodeGraphDataFrameFieldNames.detail),
    };
}
function findFieldsByPrefix(frame, prefix) {
    return frame.fields.filter(function (f) { return f.name.match(new RegExp('^' + prefix)); });
}
/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
export function processNodes(nodes, edges, theme) {
    if (!nodes) {
        return { nodes: [], edges: [] };
    }
    var nodeFields = getNodeFields(nodes);
    if (!nodeFields.id) {
        throw new Error('id field is required for nodes data frame.');
    }
    var nodesMap = nodeFields.id.values.toArray().reduce(function (acc, id, index) {
        var _a;
        acc[id] = {
            id: id,
            title: ((_a = nodeFields.title) === null || _a === void 0 ? void 0 : _a.values.get(index)) || '',
            subTitle: nodeFields.subTitle ? nodeFields.subTitle.values.get(index) : '',
            dataFrameRowIndex: index,
            incoming: 0,
            mainStat: nodeFields.mainStat,
            secondaryStat: nodeFields.secondaryStat,
            arcSections: nodeFields.arc,
            color: nodeFields.color,
        };
        return acc;
    }, {}) || {};
    var edgesMapped = [];
    // We may not have edges in case of single node
    if (edges) {
        var edgeFields_1 = getEdgeFields(edges);
        if (!edgeFields_1.id) {
            throw new Error('id field is required for edges data frame.');
        }
        edgesMapped = edgeFields_1.id.values.toArray().map(function (id, index) {
            var _a, _b;
            var target = (_a = edgeFields_1.target) === null || _a === void 0 ? void 0 : _a.values.get(index);
            var source = (_b = edgeFields_1.source) === null || _b === void 0 ? void 0 : _b.values.get(index);
            // We are adding incoming edges count so we can later on find out which nodes are the roots
            nodesMap[target].incoming++;
            return {
                id: id,
                dataFrameRowIndex: index,
                source: source,
                target: target,
                mainStat: edgeFields_1.mainStat ? statToString(edgeFields_1.mainStat, index) : '',
                secondaryStat: edgeFields_1.secondaryStat ? statToString(edgeFields_1.secondaryStat, index) : '',
            };
        });
    }
    return {
        nodes: Object.values(nodesMap),
        edges: edgesMapped || [],
        legend: nodeFields.arc.map(function (f) {
            var _a, _b;
            return {
                color: (_b = (_a = f.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) !== null && _b !== void 0 ? _b : '',
                name: f.config.displayName || f.name,
            };
        }),
    };
}
export function statToString(field, index) {
    if (field.type === FieldType.string) {
        return field.values.get(index);
    }
    else {
        var decimals = field.config.decimals || 2;
        var val = field.values.get(index);
        if (Number.isFinite(val)) {
            return field.values.get(index).toFixed(decimals) + (field.config.unit ? ' ' + field.config.unit : '');
        }
        else {
            return '';
        }
    }
}
/**
 * Utilities mainly for testing
 */
export function makeNodesDataFrame(count) {
    var frame = nodesFrame();
    for (var i = 0; i < count; i++) {
        frame.add(makeNode(i));
    }
    return frame;
}
function makeNode(index) {
    return {
        id: index.toString(),
        title: "service:" + index,
        subTitle: 'service',
        arc__success: 0.5,
        arc__errors: 0.5,
        mainStat: 0.1,
        secondaryStat: 2,
        color: 0.5,
    };
}
function nodesFrame() {
    var _a;
    var fields = (_a = {},
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
        },
        _a[NodeGraphDataFrameFieldNames.secondaryStat] = {
            values: new ArrayVector(),
            type: FieldType.number,
        },
        _a[NodeGraphDataFrameFieldNames.arc + 'success'] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { color: { fixedColor: 'green' } },
        },
        _a[NodeGraphDataFrameFieldNames.arc + 'errors'] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { color: { fixedColor: 'red' } },
        },
        _a[NodeGraphDataFrameFieldNames.color] = {
            values: new ArrayVector(),
            type: FieldType.number,
            config: { color: { mode: 'continuous-GrYlRd' } },
        },
        _a);
    return new MutableDataFrame({
        name: 'nodes',
        fields: Object.keys(fields).map(function (key) { return (__assign(__assign({}, fields[key]), { name: key })); }),
    });
}
export function makeEdgesDataFrame(edges) {
    var e_1, _a;
    var frame = edgesFrame();
    try {
        for (var edges_1 = __values(edges), edges_1_1 = edges_1.next(); !edges_1_1.done; edges_1_1 = edges_1.next()) {
            var edge = edges_1_1.value;
            frame.add({
                id: edge[0] + '--' + edge[1],
                source: edge[0].toString(),
                target: edge[1].toString(),
            });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (edges_1_1 && !edges_1_1.done && (_a = edges_1.return)) _a.call(edges_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return frame;
}
function edgesFrame() {
    var _a;
    var fields = (_a = {},
        _a[NodeGraphDataFrameFieldNames.id] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a[NodeGraphDataFrameFieldNames.source] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a[NodeGraphDataFrameFieldNames.target] = {
            values: new ArrayVector(),
            type: FieldType.string,
        },
        _a);
    return new MutableDataFrame({
        name: 'edges',
        fields: Object.keys(fields).map(function (key) { return (__assign(__assign({}, fields[key]), { name: key })); }),
    });
}
/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
export function graphBounds(nodes) {
    if (nodes.length === 0) {
        return { top: 0, right: 0, bottom: 0, left: 0, center: { x: 0, y: 0 } };
    }
    var bounds = nodes.reduce(function (acc, node) {
        if (node.x > acc.right) {
            acc.right = node.x;
        }
        if (node.x < acc.left) {
            acc.left = node.x;
        }
        if (node.y > acc.bottom) {
            acc.bottom = node.y;
        }
        if (node.y < acc.top) {
            acc.top = node.y;
        }
        return acc;
    }, { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity });
    var y = bounds.top + (bounds.bottom - bounds.top) / 2;
    var x = bounds.left + (bounds.right - bounds.left) / 2;
    return __assign(__assign({}, bounds), { center: {
            x: x,
            y: y,
        } });
}
//# sourceMappingURL=utils.js.map