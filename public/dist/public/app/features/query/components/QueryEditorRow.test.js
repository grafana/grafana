import { dateTime, LoadingState, toDataFrame } from '@grafana/data';
import { filterPanelDataToQuery } from './QueryEditorRow';
function makePretendRequest(requestId, subRequests) {
    return {
        requestId: requestId,
        // subRequests,
    };
}
describe('filterPanelDataToQuery', function () {
    var data = {
        state: LoadingState.Done,
        series: [
            toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B222' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B333' }], meta: {} }),
            toDataFrame({ refId: 'C', fields: [{ name: 'CCCC' }], meta: { requestId: 'sub3' } }),
        ],
        error: {
            refId: 'B',
            message: 'Error!!',
        },
        request: makePretendRequest('111', [
            makePretendRequest('sub1'),
            makePretendRequest('sub2'),
            makePretendRequest('sub3'),
        ]),
        timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    it('should not have an error unless the refId matches', function () {
        var panelData = filterPanelDataToQuery(data, 'A');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series.length).toBe(1);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series[0].refId).toBe('A');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.error).toBeUndefined();
    });
    it('should match the error to the query', function () {
        var panelData = filterPanelDataToQuery(data, 'B');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series.length).toBe(3);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series[0].refId).toBe('B');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.error.refId).toBe('B');
    });
    it('should include errors when missing data', function () {
        var withError = {
            series: [],
            error: {
                message: 'Error!!',
            },
        };
        var panelData = filterPanelDataToQuery(withError, 'B');
        expect(panelData).toBeDefined();
        // @ts-ignore typescript doesn't understand that panelData can't be undefined here
        expect(panelData.state).toBe(LoadingState.Error);
        // @ts-ignore typescript doesn't understand that panelData can't be undefined here
        expect(panelData.error).toBe(withError.error);
    });
});
//# sourceMappingURL=QueryEditorRow.test.js.map