import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getDefaultTimeRange, MutableDataFrame } from '@grafana/data';
import { UnconnectedNodeGraphContainer } from './NodeGraphContainer';
describe('NodeGraphContainer', () => {
    it('is collapsed if shown with traces', () => {
        var _a;
        const { container } = render(React.createElement(UnconnectedNodeGraphContainer, { dataFrames: [emptyFrame], exploreId: 'left', range: getDefaultTimeRange(), splitOpenFn: () => { }, withTraceView: true, datasourceType: '' }));
        // Make sure we only show header and loading bar container from PanelChrome in the collapsible
        expect((_a = container.firstChild) === null || _a === void 0 ? void 0 : _a.childNodes.length).toBe(2);
    });
    it('shows the graph if not with trace view', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { container } = render(React.createElement(UnconnectedNodeGraphContainer, { dataFrames: [nodes], exploreId: 'left', range: getDefaultTimeRange(), splitOpenFn: () => { }, datasourceType: '' }));
        expect((_a = container.firstChild) === null || _a === void 0 ? void 0 : _a.childNodes.length).toBe(3);
        expect(container.querySelector('svg')).toBeInTheDocument();
        yield screen.findByLabelText(/Node: tempo-querier/);
    }));
});
const emptyFrame = new MutableDataFrame();
const nodes = new MutableDataFrame({
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
    return fields.map(([name, values]) => {
        return { name, values };
    });
}
//# sourceMappingURL=NodeGraphContainer.test.js.map