import { of } from 'rxjs';
import { emptyResult, getAnnotationsByPanelId, translateQueryResult } from './utils';
var SnapshotWorker = /** @class */ (function () {
    function SnapshotWorker() {
    }
    SnapshotWorker.prototype.canWork = function (_a) {
        var _b, _c;
        var dashboard = _a.dashboard;
        return (_c = (_b = dashboard === null || dashboard === void 0 ? void 0 : dashboard.annotations) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c.some(function (a) { return a.enable && Boolean(a.snapshotData); });
    };
    SnapshotWorker.prototype.work = function (options) {
        if (!this.canWork(options)) {
            return emptyResult();
        }
        var annotations = this.getAnnotationsFromSnapshot(options.dashboard);
        return of({ annotations: annotations, alertStates: [] });
    };
    SnapshotWorker.prototype.getAnnotationsFromSnapshot = function (dashboard) {
        var _a, _b;
        var dashAnnotations = (_b = (_a = dashboard === null || dashboard === void 0 ? void 0 : dashboard.annotations) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.filter(function (a) { return a.enable; });
        var snapshots = dashAnnotations.filter(function (a) { return Boolean(a.snapshotData); });
        var annotations = snapshots.reduce(function (acc, curr) { return acc.concat(translateQueryResult(curr, curr.snapshotData)); }, []);
        return annotations;
    };
    SnapshotWorker.prototype.getAnnotationsInSnapshot = function (dashboard, panelId) {
        var annotations = this.getAnnotationsFromSnapshot(dashboard);
        return getAnnotationsByPanelId(annotations, panelId);
    };
    return SnapshotWorker;
}());
export { SnapshotWorker };
//# sourceMappingURL=SnapshotWorker.js.map