import { __awaiter } from "tslib";
import { getDefaultTimeRange } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';
import { SnapshotWorker } from './SnapshotWorker';
function getDefaultOptions() {
    const dashboard = new DashboardModel({});
    const range = getDefaultTimeRange();
    return { dashboard, range };
}
function getSnapshotData(annotation, timeEnd = undefined) {
    return [{ annotation, source: {}, timeEnd, time: 1 }];
}
function getAnnotation(timeEnd = undefined) {
    const annotation = {
        enable: true,
        hide: false,
        name: 'Test',
        iconColor: 'pink',
    };
    return Object.assign(Object.assign({}, annotation), { snapshotData: getSnapshotData(annotation, timeEnd) });
}
describe('SnapshotWorker', () => {
    const worker = new SnapshotWorker();
    describe('when canWork is called with correct props', () => {
        it('then it should return true', () => {
            const dashboard = { annotations: { list: [getAnnotation(), {}] } };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with incorrect props', () => {
        it('then it should return false', () => {
            const dashboard = { annotations: { list: [{}] } };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const dashboard = { annotations: { list: [{}] } };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            yield expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }]);
        }));
    });
    describe('when run is called with correct props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const noRegionUndefined = getAnnotation();
            const noRegionEqualTime = getAnnotation(1);
            const region = getAnnotation(2);
            const noSnapshotData = Object.assign(Object.assign({}, getAnnotation()), { snapshotData: undefined });
            const dashboard = {
                annotations: { list: [noRegionUndefined, region, noSnapshotData, noRegionEqualTime] },
            };
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const { alertStates, annotations } = received[0];
                expect(alertStates).toBeDefined();
                expect(annotations).toHaveLength(3);
                expect(annotations[0]).toEqual({
                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    timeEnd: undefined,
                    time: 1,
                    color: '#ffc0cb',
                    type: 'Test',
                    isRegion: false,
                });
                expect(annotations[1]).toEqual({
                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    timeEnd: 2,
                    time: 1,
                    color: '#ffc0cb',
                    type: 'Test',
                    isRegion: true,
                });
                expect(annotations[2]).toEqual({
                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                    timeEnd: 1,
                    time: 1,
                    color: '#ffc0cb',
                    type: 'Test',
                    isRegion: false,
                });
            });
        }));
    });
});
//# sourceMappingURL=SnapshotWorker.test.js.map