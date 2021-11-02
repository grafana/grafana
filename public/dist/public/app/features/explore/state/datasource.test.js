import { __assign } from "tslib";
import { updateDatasourceInstanceAction, datasourceReducer } from './datasource';
import { ExploreId } from 'app/types';
import { createEmptyQueryResponse } from './utils';
describe('Datasource reducer', function () {
    it('should handle set updateDatasourceInstanceAction correctly', function () {
        var StartPage = {};
        var datasourceInstance = {
            meta: {
                metrics: true,
                logs: true,
            },
            components: {
                QueryEditorHelp: StartPage,
            },
        };
        var queries = [];
        var queryKeys = [];
        var initialState = {
            datasourceInstance: null,
            queries: queries,
            queryKeys: queryKeys,
        };
        var result = datasourceReducer(initialState, updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance: datasourceInstance, history: [] }));
        var expectedState = {
            datasourceInstance: datasourceInstance,
            queries: queries,
            queryKeys: queryKeys,
            graphResult: null,
            logsResult: null,
            tableResult: null,
            loading: false,
            queryResponse: __assign(__assign({}, createEmptyQueryResponse()), { timeRange: result.queryResponse.timeRange }),
        };
        expect(result).toMatchObject(expectedState);
    });
});
//# sourceMappingURL=datasource.test.js.map