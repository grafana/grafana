import { __awaiter } from "tslib";
import { getDefaultTimeRange } from '@grafana/data';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
function getDefaultOptions(annotationQuery) {
    const annotation = {};
    const dashboard = createDashboardModelFixture();
    const datasource = {
        annotationQuery: annotationQuery !== null && annotationQuery !== void 0 ? annotationQuery : jest.fn().mockResolvedValue([{ id: '1' }]),
    };
    const range = getDefaultTimeRange();
    return { annotation, datasource, dashboard, range };
}
function getTestContext(annotationQuery) {
    jest.clearAllMocks();
    const dispatchMock = jest.spyOn(store, 'dispatch');
    const options = getDefaultOptions(annotationQuery);
    const annotationQueryMock = options.datasource.annotationQuery;
    return { options, dispatchMock, annotationQueryMock };
}
describe('LegacyAnnotationQueryRunner', () => {
    const runner = new LegacyAnnotationQueryRunner();
    describe('when canWork is called with correct props', () => {
        it('then it should return true', () => {
            const datasource = {
                annotationQuery: jest.fn(),
            };
            expect(runner.canRun(datasource)).toBe(true);
        });
    });
    describe('when canWork is called without datasource', () => {
        it('then it should return false', () => {
            const datasource = undefined;
            expect(runner.canRun(datasource)).toBe(false);
        });
    });
    describe('when canWork is called with incorrect props', () => {
        it('then it should return false', () => {
            const datasource = {
                annotationQuery: jest.fn(),
                annotations: {},
            };
            expect(runner.canRun(datasource)).toBe(false);
        });
    });
    describe('when run is called with unsupported props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const datasource = {
                annotationQuery: jest.fn(),
                annotations: {},
            };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { datasource });
            yield expect(runner.run(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual([]);
                expect(datasource.annotationQuery).not.toHaveBeenCalled();
            });
        }));
    });
    describe('when run is called and the request is successful', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { options, annotationQueryMock } = getTestContext();
            yield expect(runner.run(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual([{ id: '1' }]);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called and the request fails', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const annotationQuery = jest.fn().mockRejectedValue({ message: 'An error' });
            const { options, annotationQueryMock, dispatchMock } = getTestContext(annotationQuery);
            yield expect(runner.run(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual([]);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                expect(dispatchMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called and the request is cancelled', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const annotationQuery = jest.fn().mockRejectedValue({ cancelled: true });
            const { options, annotationQueryMock, dispatchMock } = getTestContext(annotationQuery);
            yield expect(runner.run(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual([]);
                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                expect(dispatchMock).not.toHaveBeenCalled();
            });
        }));
    });
});
//# sourceMappingURL=LegacyAnnotationQueryRunner.test.js.map