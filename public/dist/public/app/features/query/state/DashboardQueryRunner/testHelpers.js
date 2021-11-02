import { __assign } from "tslib";
import { asyncScheduler, of, scheduled } from 'rxjs';
import { getDefaultTimeRange } from '@grafana/data';
// function that creates an async of result Observable
export function toAsyncOfResult(result) {
    return scheduled(of(result), asyncScheduler);
}
export var LEGACY_DS_NAME = 'Legacy';
export var NEXT_GEN_DS_NAME = 'NextGen';
function getSnapshotData(annotation) {
    return [{ annotation: annotation, source: {}, timeEnd: 2, time: 1 }];
}
function getAnnotation(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.enable, enable = _c === void 0 ? true : _c, _d = _b.useSnapshotData, useSnapshotData = _d === void 0 ? false : _d, _e = _b.datasource, datasource = _e === void 0 ? LEGACY_DS_NAME : _e;
    var annotation = {
        id: useSnapshotData ? 'Snapshotted' : undefined,
        enable: enable,
        hide: false,
        name: 'Test',
        iconColor: 'pink',
        datasource: datasource,
    };
    return __assign(__assign({}, annotation), { snapshotData: useSnapshotData ? getSnapshotData(annotation) : undefined });
}
export function getDefaultOptions() {
    var legacy = getAnnotation({ datasource: LEGACY_DS_NAME });
    var nextGen = getAnnotation({ datasource: NEXT_GEN_DS_NAME });
    var dashboard = {
        id: 1,
        annotations: {
            list: [
                legacy,
                nextGen,
                getAnnotation({ enable: false }),
                getAnnotation({ useSnapshotData: true }),
                getAnnotation({ enable: false, useSnapshotData: true }),
            ],
        },
        events: {
            subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
            publish: jest.fn(),
        },
        panels: [{ alert: {} }],
    };
    var range = getDefaultTimeRange();
    return { dashboard: dashboard, range: range };
}
//# sourceMappingURL=testHelpers.js.map