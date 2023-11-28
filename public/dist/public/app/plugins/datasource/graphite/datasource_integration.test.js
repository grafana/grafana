import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { setBackendSrv } from '@grafana/runtime';
import { BackendSrv } from 'app/core/services/backend_srv';
import { GraphiteDatasource } from './datasource';
describe('graphiteDatasource integration with backendSrv and fetch', () => {
    let ctx = {};
    beforeEach(() => {
        jest.clearAllMocks();
        const instanceSettings = {
            url: '/api/datasources/proxy/1',
            name: 'graphiteProd',
            jsonData: {
                rollupIndicatorEnabled: true,
            },
        };
        const ds = new GraphiteDatasource(instanceSettings);
        ctx = { ds };
    });
    describe('returns a list of functions', () => {
        it('should return a list of functions with invalid JSON', () => __awaiter(void 0, void 0, void 0, function* () {
            const INVALID_JSON = '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":Infinity}]}}';
            mockBackendSrv(INVALID_JSON);
            const funcDefs = yield ctx.ds.getFuncDefs();
            expect(funcDefs).toEqual({
                testFunction: {
                    category: 'Transform',
                    defaultParams: ['inf'],
                    description: 'description',
                    fake: true,
                    name: 'function',
                    params: [
                        {
                            multiple: false,
                            name: 'param',
                            optional: false,
                            options: undefined,
                            type: 'int_or_infinity',
                        },
                    ],
                },
            });
        }));
        it('should return a list of functions with valid JSON', () => __awaiter(void 0, void 0, void 0, function* () {
            const VALID_JSON = '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":1e9999}]}}';
            mockBackendSrv(VALID_JSON);
            const funcDefs = yield ctx.ds.getFuncDefs();
            expect(funcDefs).toEqual({
                testFunction: {
                    category: 'Transform',
                    defaultParams: ['inf'],
                    description: 'description',
                    fake: true,
                    name: 'function',
                    params: [
                        {
                            multiple: false,
                            name: 'param',
                            optional: false,
                            options: undefined,
                            type: 'int_or_infinity',
                        },
                    ],
                },
            });
        }));
    });
});
function mockBackendSrv(data) {
    const defaults = {
        data: '',
        ok: true,
        status: 200,
        statusText: 'Ok',
        isSignedIn: true,
        orgId: 1337,
        redirected: false,
        type: 'basic',
        url: 'http://localhost:3000/api/some-mock',
    };
    const props = Object.assign({}, defaults);
    props.data = data;
    const textMock = jest.fn().mockResolvedValue(props.data);
    const fromFetchMock = jest.fn().mockImplementation(() => {
        const mockedResponse = {
            ok: props.ok,
            status: props.status,
            statusText: props.statusText,
            text: textMock,
            redirected: false,
            type: 'basic',
            url: 'http://localhost:3000/api/some-mock',
            headers: new Headers({
                method: 'GET',
                url: '/functions',
                // to work around Graphite returning invalid JSON
                responseType: 'text',
            }),
        };
        return of(mockedResponse);
    });
    const appEventsMock = {};
    const user = {
        isSignedIn: props.isSignedIn,
        orgId: props.orgId,
    };
    const contextSrvMock = {
        user,
    };
    const logoutMock = jest.fn();
    const mockedBackendSrv = new BackendSrv({
        fromFetch: fromFetchMock,
        appEvents: appEventsMock,
        contextSrv: contextSrvMock,
        logout: logoutMock,
    });
    setBackendSrv(mockedBackendSrv);
}
//# sourceMappingURL=datasource_integration.test.js.map