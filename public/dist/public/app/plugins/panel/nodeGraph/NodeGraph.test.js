import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NodeGraph } from './NodeGraph';
import { makeEdgesDataFrame, makeNodesDataFrame } from './utils';
jest.mock('react-use/lib/useMeasure', () => {
    return {
        __esModule: true,
        default: () => {
            return [() => { }, { width: 500, height: 200 }];
        },
    };
});
describe('NodeGraph', () => {
    it('shows no data message without any data', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [], getLinks: () => [] }));
        yield screen.findByText('No data');
    }));
    it('can zoom in and out', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [makeNodesDataFrame(2), makeEdgesDataFrame([{ source: '0', target: '1' }])], getLinks: () => [] }));
        const zoomIn = yield screen.findByTitle(/Zoom in/);
        const zoomOut = yield screen.findByTitle(/Zoom out/);
        expect(getScale()).toBe(1);
        yield userEvent.click(zoomIn);
        expect(getScale()).toBe(1.5);
        yield userEvent.click(zoomOut);
        expect(getScale()).toBe(1);
    }));
    it('can pan the graph', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(3),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '1', target: '2' },
                ]),
            ], getLinks: () => [] }));
        yield screen.findByLabelText('Node: service:1');
        panView({ x: 10, y: 10 });
        // Though we try to pan down 10px we are rendering in straight line 3 nodes so there are bounds preventing
        // as panning vertically
        yield waitFor(() => expect(getTranslate()).toEqual({ x: 10, y: 0 }));
    }));
    it('renders with single node', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [makeNodesDataFrame(1)], getLinks: () => [] }));
        const circle = yield screen.findByText('', { selector: 'circle' });
        yield screen.findByText(/service:0/);
        expect(getXY(circle)).toEqual({ x: 0, y: 0 });
    }));
    it('shows context menu when clicking on node or edge', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [makeNodesDataFrame(2), makeEdgesDataFrame([{ source: '0', target: '1' }])], getLinks: (dataFrame) => {
                return [
                    {
                        title: dataFrame.fields.find((f) => f.name === 'source') ? 'Edge traces' : 'Node traces',
                        href: '',
                        origin: null,
                        target: '_self',
                    },
                ];
            } }));
        // We mock this because for some reason the simulated click events don't have pageX/Y values resulting in some NaNs
        // for positioning and this creates a warning message.
        const origError = console.error;
        console.error = jest.fn();
        const node = yield screen.findByTestId('node-click-rect-0');
        yield userEvent.click(node);
        yield screen.findByText(/Node traces/);
        const edge = yield screen.findByLabelText(/Edge from/);
        yield userEvent.click(edge);
        yield screen.findByText(/Edge traces/);
        console.error = origError;
    }));
    it('lays out 3 nodes in single line', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(3),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '1', target: '2' },
                ]),
            ], getLinks: () => [] }));
        yield expectNodePositionCloseTo('service:0', { x: -221, y: 0 });
        yield expectNodePositionCloseTo('service:1', { x: -21, y: 0 });
        yield expectNodePositionCloseTo('service:2', { x: 221, y: 0 });
    }));
    it('lays out first children on one vertical line', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(3),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '0', target: '2' },
                ]),
            ], getLinks: () => [] }));
        // Should basically look like <
        yield expectNodePositionCloseTo('service:0', { x: -100, y: 0 });
        yield expectNodePositionCloseTo('service:1', { x: 100, y: -100 });
        yield expectNodePositionCloseTo('service:2', { x: 100, y: 100 });
    }));
    it('limits the number of nodes shown and shows a warning', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(5),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '0', target: '2' },
                    { source: '2', target: '3' },
                    { source: '3', target: '4' },
                ]),
            ], getLinks: () => [], nodeLimit: 2 }));
        const nodes = yield screen.findAllByLabelText(/Node: service:\d/);
        expect(nodes.length).toBe(2);
        screen.getByLabelText(/Nodes hidden warning/);
        const markers = yield screen.findAllByLabelText(/Hidden nodes marker: \d/);
        expect(markers.length).toBe(1);
    }));
    it('allows expanding the nodes when limiting visible nodes', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(5),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '1', target: '2' },
                    { source: '2', target: '3' },
                    { source: '3', target: '4' },
                ]),
            ], getLinks: () => [], nodeLimit: 3 }));
        const node = yield screen.findByLabelText(/Node: service:0/);
        expect(node).toBeInTheDocument();
        const marker = yield screen.findByLabelText(/Hidden nodes marker: 3/);
        yield userEvent.click(marker);
        expect(screen.queryByLabelText(/Node: service:0/)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Node: service:4/)).toBeInTheDocument();
        const nodes = yield screen.findAllByLabelText(/Node: service:\d/);
        expect(nodes.length).toBe(3);
    }));
    it('can switch to grid layout', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(NodeGraph, { dataFrames: [
                makeNodesDataFrame(3),
                makeEdgesDataFrame([
                    { source: '0', target: '1' },
                    { source: '1', target: '2' },
                ]),
            ], getLinks: () => [], nodeLimit: 3 }));
        const button = yield screen.findByTitle(/Grid layout/);
        yield userEvent.click(button);
        yield expectNodePositionCloseTo('service:0', { x: -60, y: -60 });
        yield expectNodePositionCloseTo('service:1', { x: 60, y: -60 });
        yield expectNodePositionCloseTo('service:2', { x: -60, y: 80 });
    }));
});
function expectNodePositionCloseTo(node, pos) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodePos = yield getNodeXY(node);
        expect(nodePos.x).toBeCloseTo(pos.x, -1);
        expect(nodePos.y).toBeCloseTo(pos.y, -1);
    });
}
function getNodeXY(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = yield screen.findByLabelText(new RegExp(`Node: ${node}`));
        const circle = getByText(group, '', { selector: 'circle' });
        return getXY(circle);
    });
}
function panView(toPos) {
    const svg = getSvg();
    fireEvent(svg, new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    fireEvent(document, new MouseEvent('mousemove', { clientX: toPos.x, clientY: toPos.y }));
    fireEvent(document, new MouseEvent('mouseup'));
}
function getSvg() {
    return screen.getAllByText('', { selector: 'svg' })[0];
}
function getTransform() {
    const svg = getSvg();
    const group = svg.children[0];
    return group.style.getPropertyValue('transform');
}
function getScale() {
    const scale = getTransform().match(/scale\(([\d\.]+)\)/)[1];
    return parseFloat(scale);
}
function getTranslate() {
    const matches = getTransform().match(/translate\((\d+)px, (\d+)px\)/);
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