import { render, screen } from '@testing-library/react';
import { dateTime, LoadingState, toDataFrame } from '@grafana/data';
import { filterPanelDataToQuery, QueryEditorRow } from './QueryEditorRow';
function makePretendRequest(requestId, subRequests) {
    return {
        requestId,
        // subRequests,
    };
}
describe('filterPanelDataToQuery', () => {
    const data = {
        state: LoadingState.Done,
        series: [
            toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B222' }], meta: {} }),
            toDataFrame({ refId: 'B', fields: [{ name: 'B333' }], meta: {} }),
            toDataFrame({ refId: 'C', fields: [{ name: 'CCCC' }], meta: { requestId: 'sub3' } }),
        ],
        errors: [
            {
                refId: 'B',
                message: 'Error!!',
            },
        ],
        request: makePretendRequest('111', [
            makePretendRequest('sub1'),
            makePretendRequest('sub2'),
            makePretendRequest('sub3'),
        ]),
        timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    it('should not have an error unless the refId matches', () => {
        const panelData = filterPanelDataToQuery(data, 'A');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series.length).toBe(1);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series[0].refId).toBe('A');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.error).toBeUndefined();
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.errors).toBeUndefined();
    });
    it('should match the error to the query', () => {
        const panelData = filterPanelDataToQuery(data, 'B');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series.length).toBe(3);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.series[0].refId).toBe('B');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.error.refId).toBe('B');
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.errors[0].refId).toBe('B');
    });
    it('should include errors when missing data', () => {
        const withError = {
            series: [],
            error: {
                message: 'Error!!',
            },
            errors: [{ message: 'Error!!' }],
        };
        const panelData = filterPanelDataToQuery(withError, 'B');
        expect(panelData).toBeDefined();
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.state).toBe(LoadingState.Error);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.error).toBe(withError.error);
        expect(panelData === null || panelData === void 0 ? void 0 : panelData.errors).toEqual(withError.errors);
    });
    it('should set the state to done if the frame has no errors', () => {
        const withError = Object.assign({}, data);
        withError.state = LoadingState.Error;
        const panelDataB = filterPanelDataToQuery(withError, 'B');
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.series.length).toBe(3);
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.series[0].refId).toBe('B');
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.state).toBe(LoadingState.Error);
        const panelDataA = filterPanelDataToQuery(withError, 'A');
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.series.length).toBe(1);
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.series[0].refId).toBe('A');
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.state).toBe(LoadingState.Done);
    });
    it('should return error for query that returns no data, but another query does return data', () => {
        var _a;
        const withError = Object.assign(Object.assign({}, data), { state: LoadingState.Error, error: {
                message: 'Sad',
                refId: 'Q',
            } });
        const panelDataB = filterPanelDataToQuery(withError, 'Q');
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.series.length).toBe(0);
        expect((_a = panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.error) === null || _a === void 0 ? void 0 : _a.refId).toBe('Q');
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.errors[0].refId).toBe('Q');
    });
    it('should not set the state to done if the frame is loading and has no errors', () => {
        const loadingData = {
            state: LoadingState.Loading,
            series: [
                toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
                toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
            ],
            timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
        };
        const panelDataB = filterPanelDataToQuery(loadingData, 'B');
        expect(panelDataB === null || panelDataB === void 0 ? void 0 : panelDataB.state).toBe(LoadingState.Loading);
        const panelDataA = filterPanelDataToQuery(loadingData, 'A');
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.state).toBe(LoadingState.Loading);
    });
    it('should keep the state in loading until all queries are finished, even if the current query has errored', () => {
        const loadingData = {
            state: LoadingState.Loading,
            series: [],
            error: {
                refId: 'A',
                message: 'Error',
            },
            timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
        };
        const panelDataA = filterPanelDataToQuery(loadingData, 'A');
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.state).toBe(LoadingState.Loading);
    });
    it('should keep the state in loading until all queries are finished, if another query has errored', () => {
        const loadingData = {
            state: LoadingState.Loading,
            series: [],
            error: {
                refId: 'B',
                message: 'Error',
            },
            timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
        };
        const panelDataA = filterPanelDataToQuery(loadingData, 'A');
        expect(panelDataA === null || panelDataA === void 0 ? void 0 : panelDataA.state).toBe(LoadingState.Loading);
    });
});
describe('frame results with warnings', () => {
    const meta = {
        notices: [
            {
                severity: 'warning',
                text: 'Reduce operation is not needed. Input query or expression A is already reduced data.',
            },
        ],
    };
    const dataWithWarnings = {
        state: LoadingState.Done,
        series: [
            toDataFrame({
                refId: 'B',
                fields: [{ name: 'B1' }],
                meta,
            }),
            toDataFrame({
                refId: 'B',
                fields: [{ name: 'B2' }],
                meta,
            }),
        ],
        timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    const dataWithoutWarnings = {
        state: LoadingState.Done,
        series: [
            toDataFrame({
                refId: 'B',
                fields: [{ name: 'B1' }],
                meta: {},
            }),
            toDataFrame({
                refId: 'B',
                fields: [{ name: 'B2' }],
                meta: {},
            }),
        ],
        timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    it('should show a warning badge and de-duplicate warning messages', () => {
        // @ts-ignore: there are _way_ too many props to inject here :(
        const editorRow = new QueryEditorRow({
            data: dataWithWarnings,
            query: {
                refId: 'B',
            },
        });
        const warningsComponent = editorRow.renderWarnings();
        expect(warningsComponent).not.toBe(null);
        render(warningsComponent);
        expect(screen.getByText('1 warning')).toBeInTheDocument();
    });
    it('should not show a warning badge when there are no warnings', () => {
        // @ts-ignore: there are _way_ too many props to inject here :(
        const editorRow = new QueryEditorRow({
            data: dataWithoutWarnings,
            query: {
                refId: 'B',
            },
        });
        const warningsComponent = editorRow.renderWarnings();
        expect(warningsComponent).toBe(null);
    });
});
//# sourceMappingURL=QueryEditorRow.test.js.map