import { updateDatasourceInstanceAction, datasourceReducer } from './datasource';
import { createEmptyQueryResponse } from './utils';
describe('Datasource reducer', () => {
    it('should handle set updateDatasourceInstanceAction correctly', () => {
        const StartPage = {};
        const datasourceInstance = {
            meta: {
                metrics: true,
                logs: true,
            },
            components: {
                QueryEditorHelp: StartPage,
            },
        };
        const queries = [];
        const queryKeys = [];
        const initialState = {
            datasourceInstance: null,
            queries,
            queryKeys,
        };
        const result = datasourceReducer(initialState, updateDatasourceInstanceAction({ exploreId: 'left', datasourceInstance, history: [] }));
        const expectedState = {
            datasourceInstance,
            queries,
            queryKeys,
            graphResult: null,
            logsResult: null,
            tableResult: null,
            queryResponse: Object.assign(Object.assign({}, createEmptyQueryResponse()), { timeRange: result.queryResponse.timeRange }),
        };
        expect(result).toMatchObject(expectedState);
    });
});
//# sourceMappingURL=datasource.test.js.map