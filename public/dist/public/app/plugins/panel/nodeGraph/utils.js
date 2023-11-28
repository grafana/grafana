import { FieldCache, FieldColorModeId, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames, } from '@grafana/data';
import { nodeR } from './Node';
/**
 * Makes line shorter while keeping the middle in he same place.
 */
export function shortenLine(line, sourceNodeRadius, targetNodeRadius) {
    const vx = line.x2 - line.x1;
    const vy = line.y2 - line.y1;
    const mag = Math.sqrt(vx * vx + vy * vy);
    const cosine = (line.x2 - line.x1) / mag;
    const sine = (line.y2 - line.y1) / mag;
    return {
        x1: line.x1 + cosine * (sourceNodeRadius + 5),
        y1: line.y1 + sine * (sourceNodeRadius + 5),
        x2: line.x2 - cosine * (targetNodeRadius + 5),
        y2: line.y2 - sine * (targetNodeRadius + 5),
    };
}
export function getNodeFields(nodes) {
    const normalizedFrames = Object.assign(Object.assign({}, nodes), { fields: nodes.fields.map((field) => (Object.assign(Object.assign({}, field), { name: field.name.toLowerCase() }))) });
    const fieldsCache = new FieldCache(normalizedFrames);
    return {
        id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id.toLowerCase()),
        title: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.title.toLowerCase()),
        subTitle: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.subTitle.toLowerCase()),
        mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat.toLowerCase()),
        secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat.toLowerCase()),
        arc: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.arc),
        details: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.detail),
        color: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.color),
        icon: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.icon),
        nodeRadius: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.nodeRadius.toLowerCase()),
    };
}
export function getEdgeFields(edges) {
    const normalizedFrames = Object.assign(Object.assign({}, edges), { fields: edges.fields.map((field) => (Object.assign(Object.assign({}, field), { name: field.name.toLowerCase() }))) });
    const fieldsCache = new FieldCache(normalizedFrames);
    return {
        id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id.toLowerCase()),
        source: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source.toLowerCase()),
        target: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.target.toLowerCase()),
        mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat.toLowerCase()),
        secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat.toLowerCase()),
        details: findFieldsByPrefix(edges, NodeGraphDataFrameFieldNames.detail.toLowerCase()),
    };
}
function findFieldsByPrefix(frame, prefix) {
    return frame.fields.filter((f) => f.name.match(new RegExp('^' + prefix)));
}
/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
export function processNodes(nodes, edges) {
    var _a, _b;
    if (!(edges || nodes)) {
        return { nodes: [], edges: [] };
    }
    if (nodes) {
        const nodeFields = getNodeFields(nodes);
        if (!nodeFields.id) {
            throw new Error('id field is required for nodes data frame.');
        }
        // Create the nodes here
        const nodesMap = {};
        for (let i = 0; i < nodeFields.id.values.length; i++) {
            const id = nodeFields.id.values[i];
            nodesMap[id] = makeNodeDatum(id, nodeFields, i);
        }
        // We may not have edges in case of single node
        let edgeDatums = edges ? processEdges(edges, getEdgeFields(edges), nodesMap) : [];
        for (const e of edgeDatums) {
            // We are adding incoming edges count, so we can later on find out which nodes are the roots
            nodesMap[e.target].incoming++;
        }
        return {
            nodes: Object.values(nodesMap),
            edges: edgeDatums,
            legend: nodeFields.arc.map((f) => {
                var _a, _b;
                return {
                    color: (_b = (_a = f.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) !== null && _b !== void 0 ? _b : '',
                    name: f.config.displayName || f.name,
                };
            }),
        };
    }
    else {
        // We have only edges here, so we have to construct also nodes out of them
        // We checked that either node || edges has to be defined and if nodes aren't edges has to be defined
        edges = edges;
        const nodesMap = {};
        const edgeFields = getEdgeFields(edges);
        // Turn edges into reasonable filled in nodes
        for (let i = 0; i < edges.length; i++) {
            const { source, target } = makeNodeDatumsFromEdge(edgeFields, i);
            nodesMap[target.id] = nodesMap[target.id] || target;
            nodesMap[source.id] = nodesMap[source.id] || source;
            // Check the stats fields. They can be also strings which we cannot really aggregate so only aggregate in case
            // they are numbers. Here we just sum all incoming edges to get the final value for node.
            if (computableField(edgeFields.mainStat)) {
                nodesMap[target.id].mainStatNumeric =
                    ((_a = nodesMap[target.id].mainStatNumeric) !== null && _a !== void 0 ? _a : 0) + edgeFields.mainStat.values[i];
            }
            if (computableField(edgeFields.secondaryStat)) {
                nodesMap[target.id].secondaryStatNumeric =
                    ((_b = nodesMap[target.id].secondaryStatNumeric) !== null && _b !== void 0 ? _b : 0) + edgeFields.secondaryStat.values[i];
            }
            // We are adding incoming edges count, so we can later on find out which nodes are the roots
            nodesMap[target.id].incoming++;
        }
        let edgeDatums = processEdges(edges, edgeFields, nodesMap);
        // It is expected for stats to be Field, so we have to create them.
        const nodes = normalizeStatsForNodes(nodesMap, edgeFields);
        return {
            nodes,
            edges: edgeDatums,
        };
    }
}
/**
 * Turn data frame data into EdgeDatum that node graph understands
 * @param edges
 * @param edgeFields
 */
function processEdges(edges, edgeFields, nodesMap) {
    if (!edgeFields.id) {
        throw new Error('id field is required for edges data frame.');
    }
    return edgeFields.id.values.map((id, index) => {
        var _a, _b;
        const target = (_a = edgeFields.target) === null || _a === void 0 ? void 0 : _a.values[index];
        const source = (_b = edgeFields.source) === null || _b === void 0 ? void 0 : _b.values[index];
        const sourceNode = nodesMap[source];
        const targetNode = nodesMap[target];
        return {
            id,
            dataFrameRowIndex: index,
            source,
            target,
            sourceNodeRadius: !sourceNode.nodeRadius ? nodeR : sourceNode.nodeRadius.values[sourceNode.dataFrameRowIndex],
            targetNodeRadius: !targetNode.nodeRadius ? nodeR : targetNode.nodeRadius.values[targetNode.dataFrameRowIndex],
            mainStat: edgeFields.mainStat ? statToString(edgeFields.mainStat.config, edgeFields.mainStat.values[index]) : '',
            secondaryStat: edgeFields.secondaryStat
                ? statToString(edgeFields.secondaryStat.config, edgeFields.secondaryStat.values[index])
                : '',
        };
    });
}
function computableField(field) {
    return field && field.type === FieldType.number;
}
/**
 * Instead of just simple numbers node graph requires to have Field in NodeDatum (probably for some formatting info in
 * config). So we create them here and fill with correct data.
 * @param nodesMap
 * @param edgeFields
 */
function normalizeStatsForNodes(nodesMap, edgeFields) {
    const secondaryStatValues = [];
    const mainStatValues = [];
    const secondaryStatField = computableField(edgeFields.secondaryStat)
        ? Object.assign(Object.assign({}, edgeFields.secondaryStat), { values: secondaryStatValues }) : undefined;
    const mainStatField = computableField(edgeFields.mainStat)
        ? Object.assign(Object.assign({}, edgeFields.mainStat), { values: mainStatValues }) : undefined;
    return Object.values(nodesMap).map((node, index) => {
        if (mainStatField || secondaryStatField) {
            const newNode = Object.assign({}, node);
            if (mainStatField) {
                newNode.mainStat = mainStatField;
                mainStatValues.push(node.mainStatNumeric);
                newNode.dataFrameRowIndex = index;
            }
            if (secondaryStatField) {
                newNode.secondaryStat = secondaryStatField;
                secondaryStatValues.push(node.secondaryStatNumeric);
                newNode.dataFrameRowIndex = index;
            }
            return newNode;
        }
        return node;
    });
}
function makeNodeDatumsFromEdge(edgeFields, index) {
    var _a, _b;
    const targetId = (_a = edgeFields.target) === null || _a === void 0 ? void 0 : _a.values[index];
    const sourceId = (_b = edgeFields.source) === null || _b === void 0 ? void 0 : _b.values[index];
    return {
        target: makeSimpleNodeDatum(targetId, index),
        source: makeSimpleNodeDatum(sourceId, index),
    };
}
function makeSimpleNodeDatum(name, index) {
    return {
        id: name,
        title: name,
        subTitle: '',
        dataFrameRowIndex: index,
        incoming: 0,
        arcSections: [],
    };
}
function makeNodeDatum(id, nodeFields, index) {
    var _a, _b, _c;
    return {
        id: id,
        title: ((_a = nodeFields.title) === null || _a === void 0 ? void 0 : _a.values[index]) || '',
        subTitle: ((_b = nodeFields.subTitle) === null || _b === void 0 ? void 0 : _b.values[index]) || '',
        dataFrameRowIndex: index,
        incoming: 0,
        mainStat: nodeFields.mainStat,
        secondaryStat: nodeFields.secondaryStat,
        arcSections: nodeFields.arc,
        color: nodeFields.color,
        icon: ((_c = nodeFields.icon) === null || _c === void 0 ? void 0 : _c.values[index]) || '',
        nodeRadius: nodeFields.nodeRadius,
    };
}
export function statToString(config, value) {
    if (typeof value === 'string') {
        return value;
    }
    else {
        const decimals = config.decimals || 2;
        if (Number.isFinite(value)) {
            return value.toFixed(decimals) + (config.unit ? ' ' + config.unit : '');
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
    const frame = nodesFrame();
    for (let i = 0; i < count; i++) {
        frame.add(makeNode(i));
    }
    return frame;
}
function makeNode(index) {
    return {
        id: index.toString(),
        title: `service:${index}`,
        subtitle: 'service',
        arc__success: 0.5,
        arc__errors: 0.5,
        mainstat: 0.1,
        secondarystat: 2,
        color: 0.5,
        icon: 'database',
        noderadius: 40,
    };
}
function nodesFrame() {
    const fields = {
        [NodeGraphDataFrameFieldNames.id]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.title]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.subTitle]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.mainStat]: {
            values: [],
            type: FieldType.number,
        },
        [NodeGraphDataFrameFieldNames.secondaryStat]: {
            values: [],
            type: FieldType.number,
        },
        [NodeGraphDataFrameFieldNames.arc + 'success']: {
            values: [],
            type: FieldType.number,
            config: { color: { fixedColor: 'green' } },
        },
        [NodeGraphDataFrameFieldNames.arc + 'errors']: {
            values: [],
            type: FieldType.number,
            config: { color: { fixedColor: 'red' } },
        },
        [NodeGraphDataFrameFieldNames.color]: {
            values: [],
            type: FieldType.number,
            config: { color: { mode: 'continuous-GrYlRd' } },
        },
        [NodeGraphDataFrameFieldNames.icon]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.nodeRadius]: {
            values: [],
            type: FieldType.number,
        },
    };
    return new MutableDataFrame({
        name: 'nodes',
        fields: Object.keys(fields).map((key) => (Object.assign(Object.assign({}, fields[key]), { name: key }))),
    });
}
export function makeEdgesDataFrame(edges) {
    const frame = edgesFrame();
    for (const edge of edges) {
        frame.add(Object.assign({ id: edge.source + '--' + edge.target }, edge));
    }
    return frame;
}
function edgesFrame() {
    const fields = {
        [NodeGraphDataFrameFieldNames.id]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.source]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.target]: {
            values: [],
            type: FieldType.string,
        },
        [NodeGraphDataFrameFieldNames.mainStat]: {
            values: [],
            type: FieldType.number,
        },
        [NodeGraphDataFrameFieldNames.secondaryStat]: {
            values: [],
            type: FieldType.number,
        },
    };
    return new MutableDataFrame({
        name: 'edges',
        fields: Object.keys(fields).map((key) => (Object.assign(Object.assign({}, fields[key]), { name: key }))),
    });
}
/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
export function graphBounds(nodes) {
    if (nodes.length === 0) {
        return { top: 0, right: 0, bottom: 0, left: 0, center: { x: 0, y: 0 } };
    }
    const bounds = nodes.reduce((acc, node) => {
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
    const y = bounds.top + (bounds.bottom - bounds.top) / 2;
    const x = bounds.left + (bounds.right - bounds.left) / 2;
    return Object.assign(Object.assign({}, bounds), { center: {
            x,
            y,
        } });
}
export function getNodeGraphDataFrames(frames, options) {
    // TODO: this not in sync with how other types of responses are handled. Other types have a query response
    //  processing pipeline which ends up populating redux state with proper data. As we move towards more dataFrame
    //  oriented API it seems like a better direction to move such processing into to visualisations and do minimal
    //  and lazy processing here. Needs bigger refactor so keeping nodeGraph and Traces as they are for now.
    let nodeGraphFrames = frames.filter((frame) => {
        var _a;
        if (((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'nodeGraph') {
            return true;
        }
        if (frame.name === 'nodes' || frame.name === 'edges' || frame.refId === 'nodes' || frame.refId === 'edges') {
            return true;
        }
        const fieldsCache = new FieldCache(frame);
        if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id)) {
            return true;
        }
        return false;
    });
    // If panel options are provided, interpolate their values in to the data frames
    if (options) {
        nodeGraphFrames = applyOptionsToFrames(nodeGraphFrames, options);
    }
    return nodeGraphFrames;
}
export const applyOptionsToFrames = (frames, options) => {
    return frames.map((frame) => {
        var _a, _b, _c, _d, _e, _f;
        const fieldsCache = new FieldCache(frame);
        // Edges frame has source which can be used to identify nodes vs edges frames
        if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source.toLowerCase())) {
            if ((_a = options === null || options === void 0 ? void 0 : options.edges) === null || _a === void 0 ? void 0 : _a.mainStatUnit) {
                const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
                if (field) {
                    field.config = Object.assign(Object.assign({}, field.config), { unit: options.edges.mainStatUnit });
                }
            }
            if ((_b = options === null || options === void 0 ? void 0 : options.edges) === null || _b === void 0 ? void 0 : _b.secondaryStatUnit) {
                const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat);
                if (field) {
                    field.config = Object.assign(Object.assign({}, field.config), { unit: options.edges.secondaryStatUnit });
                }
            }
        }
        else {
            if ((_c = options === null || options === void 0 ? void 0 : options.nodes) === null || _c === void 0 ? void 0 : _c.mainStatUnit) {
                const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
                if (field) {
                    field.config = Object.assign(Object.assign({}, field.config), { unit: options.nodes.mainStatUnit });
                }
            }
            if ((_d = options === null || options === void 0 ? void 0 : options.nodes) === null || _d === void 0 ? void 0 : _d.secondaryStatUnit) {
                const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat);
                if (field) {
                    field.config = Object.assign(Object.assign({}, field.config), { unit: options.nodes.secondaryStatUnit });
                }
            }
            if ((_f = (_e = options === null || options === void 0 ? void 0 : options.nodes) === null || _e === void 0 ? void 0 : _e.arcs) === null || _f === void 0 ? void 0 : _f.length) {
                for (const arc of options.nodes.arcs) {
                    const field = frame.fields.find((field) => field.name.toLowerCase() === arc.field);
                    if (field && arc.color) {
                        field.config = Object.assign(Object.assign({}, field.config), { color: { fixedColor: arc.color, mode: FieldColorModeId.Fixed } });
                    }
                }
            }
        }
        return frame;
    });
};
// Returns an array of node ids which are connected to a given edge
export const findConnectedNodesForEdge = (nodes, edges, edgeId) => {
    const edge = edges.find((edge) => edge.id === edgeId);
    if (edge) {
        return [
            ...new Set(nodes.filter((node) => edge.source === node.id || edge.target === node.id).map((node) => node.id)),
        ];
    }
    return [];
};
// Returns an array of node ids which are connected to a given node
export const findConnectedNodesForNode = (nodes, edges, nodeId) => {
    const node = nodes.find((node) => node.id === nodeId);
    if (node) {
        const linkedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
        return [
            ...new Set(linkedEdges.flatMap((edge) => nodes.filter((n) => edge.source === n.id || edge.target === n.id).map((n) => n.id))),
        ];
    }
    return [];
};
export const getGraphFrame = (frames) => {
    return frames.reduce((acc, frame) => {
        const sourceField = frame.fields.filter((f) => f.name === 'source');
        if (sourceField.length) {
            acc.edges.push(frame);
        }
        else {
            acc.nodes.push(frame);
        }
        return acc;
    }, { edges: [], nodes: [] });
};
//# sourceMappingURL=utils.js.map