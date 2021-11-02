import { __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, fireEvent, waitFor, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeGraph } from './NodeGraph';
import { makeEdgesDataFrame, makeNodesDataFrame } from './utils';
jest.mock('./layout.worker.js');
jest.mock('react-use/lib/useMeasure', function () {
    return {
        __esModule: true,
        default: function () {
            return [function () { }, { width: 500, height: 200 }];
        },
    };
});
describe('NodeGraph', function () {
    it('doesnt fail without any data', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            render(React.createElement(NodeGraph, { dataFrames: [], getLinks: function () { return []; } }));
            return [2 /*return*/];
        });
    }); });
    it('can zoom in and out', function () { return __awaiter(void 0, void 0, void 0, function () {
        var zoomIn, zoomOut;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [], getLinks: function () { return []; } }));
                    return [4 /*yield*/, screen.findByTitle(/Zoom in/)];
                case 1:
                    zoomIn = _a.sent();
                    return [4 /*yield*/, screen.findByTitle(/Zoom out/)];
                case 2:
                    zoomOut = _a.sent();
                    expect(getScale()).toBe(1);
                    userEvent.click(zoomIn);
                    expect(getScale()).toBe(1.5);
                    userEvent.click(zoomOut);
                    expect(getScale()).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('can pan the graph', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(3),
                            makeEdgesDataFrame([
                                [0, 1],
                                [1, 2],
                            ]),
                        ], getLinks: function () { return []; } }));
                    return [4 /*yield*/, screen.findByLabelText('Node: service:1')];
                case 1:
                    _a.sent();
                    panView({ x: 10, y: 10 });
                    // Though we try to pan down 10px we are rendering in straight line 3 nodes so there are bounds preventing
                    // as panning vertically
                    return [4 /*yield*/, waitFor(function () { return expect(getTranslate()).toEqual({ x: 10, y: 0 }); })];
                case 2:
                    // Though we try to pan down 10px we are rendering in straight line 3 nodes so there are bounds preventing
                    // as panning vertically
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders with single node', function () { return __awaiter(void 0, void 0, void 0, function () {
        var circle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [makeNodesDataFrame(1)], getLinks: function () { return []; } }));
                    return [4 /*yield*/, screen.findByText('', { selector: 'circle' })];
                case 1:
                    circle = _a.sent();
                    return [4 /*yield*/, screen.findByText(/service:0/)];
                case 2:
                    _a.sent();
                    expect(getXY(circle)).toEqual({ x: 0, y: 0 });
                    return [2 /*return*/];
            }
        });
    }); });
    it('shows context menu when clicking on node or edge', function () { return __awaiter(void 0, void 0, void 0, function () {
        var node, edge;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [makeNodesDataFrame(2), makeEdgesDataFrame([[0, 1]])], getLinks: function (dataFrame) {
                            return [
                                {
                                    title: dataFrame.fields.find(function (f) { return f.name === 'source'; }) ? 'Edge traces' : 'Node traces',
                                    href: '',
                                    origin: null,
                                    target: '_self',
                                },
                            ];
                        } }));
                    return [4 /*yield*/, screen.findByLabelText(/Node: service:0/)];
                case 1:
                    node = _a.sent();
                    // This shows warning because there is no position for the click. We cannot add any because we use pageX/Y in the
                    // context menu which is experimental (but supported) property and userEvents does not seem to support that
                    userEvent.click(node);
                    return [4 /*yield*/, screen.findByText(/Node traces/)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, screen.findByLabelText(/Edge from/)];
                case 3:
                    edge = _a.sent();
                    userEvent.click(edge);
                    return [4 /*yield*/, screen.findByText(/Edge traces/)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('lays out 3 nodes in single line', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(3),
                            makeEdgesDataFrame([
                                [0, 1],
                                [1, 2],
                            ]),
                        ], getLinks: function () { return []; } }));
                    return [4 /*yield*/, expectNodePositionCloseTo('service:0', { x: -221, y: 0 })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:1', { x: -21, y: 0 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:2', { x: 221, y: 0 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('lays out first children on one vertical line', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(3),
                            makeEdgesDataFrame([
                                [0, 1],
                                [0, 2],
                            ]),
                        ], getLinks: function () { return []; } }));
                    // Should basically look like <
                    return [4 /*yield*/, expectNodePositionCloseTo('service:0', { x: -100, y: 0 })];
                case 1:
                    // Should basically look like <
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:1', { x: 100, y: -100 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:2', { x: 100, y: 100 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('limits the number of nodes shown and shows a warning', function () { return __awaiter(void 0, void 0, void 0, function () {
        var nodes, markers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(5),
                            makeEdgesDataFrame([
                                [0, 1],
                                [0, 2],
                                [2, 3],
                                [3, 4],
                            ]),
                        ], getLinks: function () { return []; }, nodeLimit: 2 }));
                    return [4 /*yield*/, screen.findAllByLabelText(/Node: service:\d/)];
                case 1:
                    nodes = _a.sent();
                    expect(nodes.length).toBe(2);
                    screen.getByLabelText(/Nodes hidden warning/);
                    return [4 /*yield*/, screen.findAllByLabelText(/Hidden nodes marker: \d/)];
                case 2:
                    markers = _a.sent();
                    expect(markers.length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('allows expanding the nodes when limiting visible nodes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var node, marker, nodes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(5),
                            makeEdgesDataFrame([
                                [0, 1],
                                [1, 2],
                                [2, 3],
                                [3, 4],
                            ]),
                        ], getLinks: function () { return []; }, nodeLimit: 3 }));
                    return [4 /*yield*/, screen.findByLabelText(/Node: service:0/)];
                case 1:
                    node = _a.sent();
                    expect(node).toBeInTheDocument();
                    return [4 /*yield*/, screen.findByLabelText(/Hidden nodes marker: 3/)];
                case 2:
                    marker = _a.sent();
                    userEvent.click(marker);
                    expect(screen.queryByLabelText(/Node: service:0/)).not.toBeInTheDocument();
                    expect(screen.getByLabelText(/Node: service:4/)).toBeInTheDocument();
                    return [4 /*yield*/, screen.findAllByLabelText(/Node: service:\d/)];
                case 3:
                    nodes = _a.sent();
                    expect(nodes.length).toBe(3);
                    return [2 /*return*/];
            }
        });
    }); });
    it('can switch to grid layout', function () { return __awaiter(void 0, void 0, void 0, function () {
        var button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(React.createElement(NodeGraph, { dataFrames: [
                            makeNodesDataFrame(3),
                            makeEdgesDataFrame([
                                [0, 1],
                                [1, 2],
                            ]),
                        ], getLinks: function () { return []; }, nodeLimit: 3 }));
                    return [4 /*yield*/, screen.findByTitle(/Grid layout/)];
                case 1:
                    button = _a.sent();
                    userEvent.click(button);
                    return [4 /*yield*/, expectNodePositionCloseTo('service:0', { x: -60, y: -60 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:1', { x: 60, y: -60 })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, expectNodePositionCloseTo('service:2', { x: -60, y: 80 })];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
function expectNodePositionCloseTo(node, pos) {
    return __awaiter(this, void 0, void 0, function () {
        var nodePos;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getNodeXY(node)];
                case 1:
                    nodePos = _a.sent();
                    expect(nodePos.x).toBeCloseTo(pos.x, -1);
                    expect(nodePos.y).toBeCloseTo(pos.y, -1);
                    return [2 /*return*/];
            }
        });
    });
}
function getNodeXY(node) {
    return __awaiter(this, void 0, void 0, function () {
        var group, circle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, screen.findByLabelText(new RegExp("Node: " + node))];
                case 1:
                    group = _a.sent();
                    circle = getByText(group, '', { selector: 'circle' });
                    return [2 /*return*/, getXY(circle)];
            }
        });
    });
}
function panView(toPos) {
    var svg = getSvg();
    fireEvent(svg, new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    fireEvent(document, new MouseEvent('mousemove', { clientX: toPos.x, clientY: toPos.y }));
    fireEvent(document, new MouseEvent('mouseup'));
}
function getSvg() {
    return screen.getAllByText('', { selector: 'svg' })[0];
}
function getTransform() {
    var svg = getSvg();
    var group = svg.children[0];
    return group.style.getPropertyValue('transform');
}
function getScale() {
    var scale = getTransform().match(/scale\(([\d\.]+)\)/)[1];
    return parseFloat(scale);
}
function getTranslate() {
    var matches = getTransform().match(/translate\((\d+)px, (\d+)px\)/);
    return {
        x: parseFloat(matches[1]),
        y: parseFloat(matches[2]),
    };
}
function getXY(e) {
    var _a, _b;
    return {
        x: parseFloat(((_a = e.attributes.getNamedItem('cx')) === null || _a === void 0 ? void 0 : _a.value) || ''),
        y: parseFloat(((_b = e.attributes.getNamedItem('cy')) === null || _b === void 0 ? void 0 : _b.value) || ''),
    };
}
//# sourceMappingURL=NodeGraph.test.js.map