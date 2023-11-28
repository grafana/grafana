import { __awaiter } from "tslib";
import { MutableDataFrame } from '@grafana/data';
import { defaultDashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import * as api from 'app/features/dashboard/state/initDashboard';
import { createEmptyQueryResponse } from '../../state/utils';
import { setDashboardInLocalStorage } from './addToDashboard';
describe('addPanelToDashboard', () => {
    let spy;
    beforeAll(() => {
        spy = jest.spyOn(api, 'setDashboardToFetchFromLocalStorage');
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    it('Correct datasource ref is used', () => __awaiter(void 0, void 0, void 0, function* () {
        yield setDashboardInLocalStorage({
            queries: [],
            queryResponse: createEmptyQueryResponse(),
            datasource: { type: 'loki', uid: 'someUid' },
        });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            dashboard: expect.objectContaining({
                panels: expect.arrayContaining([expect.objectContaining({ datasource: { type: 'loki', uid: 'someUid' } })]),
            }),
        }));
    }));
    it('All queries are correctly passed through', () => __awaiter(void 0, void 0, void 0, function* () {
        const queries = [{ refId: 'A' }, { refId: 'B', hide: true }];
        yield setDashboardInLocalStorage({
            queries,
            queryResponse: createEmptyQueryResponse(),
        });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            dashboard: expect.objectContaining({
                panels: expect.arrayContaining([expect.objectContaining({ targets: expect.arrayContaining(queries) })]),
            }),
        }));
    }));
    it('Previous panels should not be removed', () => __awaiter(void 0, void 0, void 0, function* () {
        const queries = [{ refId: 'A' }];
        const existingPanel = { prop: 'this should be kept' };
        jest.spyOn(backendSrv, 'getDashboardByUid').mockResolvedValue({
            dashboard: Object.assign(Object.assign({}, defaultDashboard), { templating: { list: [] }, title: 'Previous panels should not be removed', uid: 'someUid', panels: [existingPanel] }),
            meta: {},
        });
        yield setDashboardInLocalStorage({
            queries,
            queryResponse: createEmptyQueryResponse(),
            dashboardUid: 'someUid',
            datasource: { type: '' },
        });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            dashboard: expect.objectContaining({
                panels: expect.arrayContaining([
                    expect.objectContaining({ targets: expect.arrayContaining(queries) }),
                    existingPanel,
                ]),
            }),
        }));
    }));
    describe('Setting visualization type', () => {
        describe('Defaults to table', () => {
            const cases = [
                ['If response is empty', [{ refId: 'A' }], createEmptyQueryResponse()],
                ['If no query is active', [{ refId: 'A', hide: true }], createEmptyQueryResponse()],
                [
                    'If no query is active, even when there is a response from a previous execution',
                    [{ refId: 'A', hide: true }],
                    Object.assign(Object.assign({}, createEmptyQueryResponse()), { logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })] }),
                ],
            ];
            it.each(cases)('%s', (_, queries, queryResponse) => __awaiter(void 0, void 0, void 0, function* () {
                yield setDashboardInLocalStorage({ queries, queryResponse });
                expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                    dashboard: expect.objectContaining({
                        panels: expect.arrayContaining([expect.objectContaining({ type: 'table' })]),
                    }),
                }));
            }));
        });
        describe('Correctly set visualization based on response', () => {
            it.each `
        framesType            | expectedPanel
        ${'logsFrames'}       | ${'logs'}
        ${'graphFrames'}      | ${'timeseries'}
        ${'nodeGraphFrames'}  | ${'nodeGraph'}
        ${'flameGraphFrames'} | ${'flamegraph'}
        ${'traceFrames'}      | ${'traces'}
      `('Sets visualization to $expectedPanel if there are $frameType frames', ({ framesType, expectedPanel }) => __awaiter(void 0, void 0, void 0, function* () {
                const queries = [{ refId: 'A' }];
                const queryResponse = Object.assign(Object.assign({}, createEmptyQueryResponse()), { [framesType]: [new MutableDataFrame({ refId: 'A', fields: [] })] });
                yield setDashboardInLocalStorage({ queries, queryResponse });
                expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                    dashboard: expect.objectContaining({
                        panels: expect.arrayContaining([expect.objectContaining({ type: expectedPanel })]),
                    }),
                }));
            }));
            it('Sets visualization to plugin panel ID if there are custom panel frames', () => __awaiter(void 0, void 0, void 0, function* () {
                const queries = [{ refId: 'A' }];
                const queryResponse = Object.assign(Object.assign({}, createEmptyQueryResponse()), { ['customFrames']: [
                        new MutableDataFrame({
                            refId: 'A',
                            fields: [],
                            meta: { preferredVisualisationPluginId: 'someCustomPluginId' },
                        }),
                    ] });
                yield setDashboardInLocalStorage({ queries, queryResponse });
                expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                    dashboard: expect.objectContaining({
                        panels: expect.arrayContaining([expect.objectContaining({ type: 'someCustomPluginId' })]),
                    }),
                }));
            }));
        });
    });
});
//# sourceMappingURL=addToDashboard.test.js.map