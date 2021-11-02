import { __awaiter, __generator, __read } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnconnectedNodeGraphContainer } from './NodeGraphContainer';
import { getDefaultTimeRange, MutableDataFrame } from '@grafana/data';
import { ExploreId } from '../../types';
jest.mock('../../plugins/panel/nodeGraph/layout.worker.js');
describe('NodeGraphContainer', function () {
    it('is collapsed if shown with traces', function () {
        var _a;
        var container = render(React.createElement(UnconnectedNodeGraphContainer, { dataFrames: [emptyFrame], exploreId: ExploreId.left, range: getDefaultTimeRange(), splitOpen: (function () { }), withTraceView: true })).container;
        // Make sure we only show header in the collapsible
        expect((_a = container.firstChild) === null || _a === void 0 ? void 0 : _a.childNodes.length).toBe(1);
    });
    it('shows the graph if not with trace view', function () { return __awaiter(void 0, void 0, void 0, function () {
        var container;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    container = render(React.createElement(UnconnectedNodeGraphContainer, { dataFrames: [nodes], exploreId: ExploreId.left, range: getDefaultTimeRange(), splitOpen: (function () { }) })).container;
                    expect((_a = container.firstChild) === null || _a === void 0 ? void 0 : _a.childNodes.length).toBe(2);
                    expect(container.querySelector('svg')).toBeInTheDocument();
                    return [4 /*yield*/, screen.findByLabelText(/Node: tempo-querier/)];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
var emptyFrame = new MutableDataFrame();
var nodes = new MutableDataFrame({
    fields: toFields([
        ['id', ['3fa414edcef6ad90']],
        ['title', ['tempo-querier']],
        ['subTitle', ['HTTP GET - api_traces_traceid']],
        ['mainStat', ['1049.14ms (100%)']],
        ['secondaryStat', ['1047.29ms (99.82%)']],
        ['color', [0.9982395121342127]],
    ]),
});
function toFields(fields) {
    return fields.map(function (_a) {
        var _b = __read(_a, 2), name = _b[0], values = _b[1];
        return { name: name, values: values };
    });
}
//# sourceMappingURL=NodeGraphContainer.test.js.map