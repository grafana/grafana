import { __awaiter } from "tslib";
import { Subject, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { setDataSourceSrv, config } from '@grafana/runtime';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as annotationsSrv from '../../../annotations/executeAnnotationQuery';
import { AnnotationsWorker } from './AnnotationsWorker';
import { createDashboardQueryRunner, setDashboardQueryRunnerFactory, } from './DashboardQueryRunner';
import { PublicAnnotationsDataSource } from './PublicAnnotationsDataSource';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { emptyResult } from './utils';
function getTestContext(dataSourceSrvRejects = false) {
    jest.clearAllMocks();
    const cancellations = new Subject();
    setDashboardQueryRunnerFactory(() => ({
        getResult: emptyResult,
        run: () => undefined,
        cancel: () => undefined,
        cancellations: () => cancellations,
        destroy: () => undefined,
    }));
    createDashboardQueryRunner({});
    const executeAnnotationQueryMock = jest
        .spyOn(annotationsSrv, 'executeAnnotationQuery')
        .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
    const annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
    const dataSourceSrvMock = {
        get: (name) => __awaiter(this, void 0, void 0, function* () {
            if (dataSourceSrvRejects) {
                return Promise.reject(`Could not find datasource with name: ${name}`);
            }
            if (name === LEGACY_DS_NAME) {
                return {
                    annotationQuery: annotationQueryMock,
                };
            }
            if (name === NEXT_GEN_DS_NAME) {
                return {
                    annotations: {},
                };
            }
            return {};
        }),
    };
    setDataSourceSrv(dataSourceSrvMock);
    const options = getDefaultOptions();
    return { options, annotationQueryMock, executeAnnotationQueryMock, cancellations };
}
function expectOnResults(args) {
    const { worker, done, options, expect: expectCallback } = args;
    const subscription = worker.work(options).subscribe({
        next: (value) => {
            try {
                expectCallback(value);
                subscription.unsubscribe();
                done();
            }
            catch (err) {
                subscription.unsubscribe();
                done(err);
            }
        },
    });
}
jest.mock('./PublicAnnotationsDataSource');
describe('AnnotationsWorker', () => {
    const worker = new AnnotationsWorker();
    describe('when canWork is called with correct props', () => {
        it('then it should return true', () => {
            const options = getDefaultOptions();
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with incorrect props', () => {
        it('then it should return false', () => {
            const dashboard = { annotations: { list: [] } };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const dashboard = { annotations: { list: [] } };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            yield expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }]);
        }));
    });
    describe('when run is called with correct props and all workers are successful', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const result = received[0];
                expect(result).toEqual({
                    alertStates: [],
                    annotations: [
                        {
                            id: 'Legacy',
                            source: {
                                enable: true,
                                hide: false,
                                name: 'Test',
                                iconColor: 'pink',
                                snapshotData: undefined,
                                datasource: 'Legacy',
                            },
                            color: '#ffc0cb',
                            type: 'Test',
                            isRegion: false,
                        },
                        {
                            id: 'NextGen',
                            source: {
                                enable: true,
                                hide: false,
                                name: 'Test',
                                iconColor: 'pink',
                                snapshotData: undefined,
                                datasource: 'NextGen',
                            },
                            color: '#ffc0cb',
                            type: 'Test',
                            isRegion: false,
                        },
                    ],
                });
                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called with correct props and legacy worker fails', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
            annotationQueryMock.mockRejectedValue({ message: 'Some error' });
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const result = received[0];
                expect(result).toEqual({
                    alertStates: [],
                    annotations: [
                        {
                            id: 'NextGen',
                            source: {
                                enable: true,
                                hide: false,
                                name: 'Test',
                                iconColor: 'pink',
                                snapshotData: undefined,
                                datasource: 'NextGen',
                            },
                            color: '#ffc0cb',
                            type: 'Test',
                            isRegion: false,
                        },
                    ],
                });
                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called with correct props and a worker is cancelled', () => {
        it('then it should return the correct results', (done) => {
            const { options, executeAnnotationQueryMock, annotationQueryMock, cancellations } = getTestContext();
            executeAnnotationQueryMock.mockReturnValueOnce(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000)));
            expectOnResults({
                worker,
                options,
                done,
                expect: (results) => {
                    expect(results).toEqual({
                        alertStates: [],
                        annotations: [
                            {
                                id: 'Legacy',
                                source: {
                                    enable: true,
                                    hide: false,
                                    name: 'Test',
                                    iconColor: 'pink',
                                    snapshotData: undefined,
                                    datasource: 'Legacy',
                                },
                                color: '#ffc0cb',
                                type: 'Test',
                                isRegion: false,
                            },
                        ],
                    });
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                },
            });
            setTimeout(() => {
                // call to async needs to be async or the cancellation will be called before any of the runners have started
                cancellations.next(options.dashboard.annotations.list[1]);
            }, 100);
        });
    });
    describe('when run is called with correct props and nextgen worker fails', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
            executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const result = received[0];
                expect(result).toEqual({
                    alertStates: [],
                    annotations: [
                        {
                            id: 'Legacy',
                            source: {
                                enable: true,
                                hide: false,
                                name: 'Test',
                                iconColor: 'pink',
                                snapshotData: undefined,
                                datasource: 'Legacy',
                            },
                            color: '#ffc0cb',
                            type: 'Test',
                            isRegion: false,
                        },
                    ],
                });
                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called with correct props and both workers fail', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
            annotationQueryMock.mockRejectedValue({ message: 'Some error' });
            executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const result = received[0];
                expect(result).toEqual({ alertStates: [], annotations: [] });
                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called with correct props and call to datasourceSrv fails', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext(true);
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const result = received[0];
                expect(result).toEqual({ alertStates: [], annotations: [] });
                expect(executeAnnotationQueryMock).not.toHaveBeenCalled();
                expect(annotationQueryMock).not.toHaveBeenCalled();
            });
        }));
    });
    describe('public dashboard scope', () => {
        test('does not call PublicAnnotationsDataSource when it is not a public dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, annotationQueryMock } = getTestContext();
            yield expect(worker.work(options)).toEmitValuesWith(() => {
                expect(PublicAnnotationsDataSource).not.toHaveBeenCalled();
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
        test('calls PublicAnnotationsDataSource when it is a public dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
            config.publicDashboardAccessToken = 'abc123';
            const { options, annotationQueryMock } = getTestContext(true);
            yield expect(worker.work(options)).toEmitValuesWith(() => {
                expect(PublicAnnotationsDataSource).toHaveBeenCalledTimes(1);
                expect(annotationQueryMock).not.toHaveBeenCalled();
            });
        }));
    });
});
//# sourceMappingURL=AnnotationsWorker.test.js.map