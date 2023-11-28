import { of } from 'rxjs';
import { emptyResult, getAnnotationsByPanelId, translateQueryResult } from './utils';
export class SnapshotWorker {
    canWork({ dashboard }) {
        var _a, _b;
        return (_b = (_a = dashboard === null || dashboard === void 0 ? void 0 : dashboard.annotations) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.some((a) => a.enable && Boolean(a.snapshotData));
    }
    work(options) {
        if (!this.canWork(options)) {
            return emptyResult();
        }
        const annotations = this.getAnnotationsFromSnapshot(options.dashboard);
        return of({ annotations, alertStates: [] });
    }
    getAnnotationsFromSnapshot(dashboard) {
        var _a, _b;
        const dashAnnotations = (_b = (_a = dashboard === null || dashboard === void 0 ? void 0 : dashboard.annotations) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.filter((a) => a.enable);
        const snapshots = dashAnnotations.filter((a) => Boolean(a.snapshotData));
        const annotations = snapshots.reduce((acc, curr) => acc.concat(translateQueryResult(curr, curr.snapshotData)), []);
        return annotations;
    }
    getAnnotationsInSnapshot(dashboard, panelId) {
        const annotations = this.getAnnotationsFromSnapshot(dashboard);
        return getAnnotationsByPanelId(annotations, panelId);
    }
}
//# sourceMappingURL=SnapshotWorker.js.map