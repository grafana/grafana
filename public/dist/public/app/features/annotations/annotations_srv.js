import { __assign, __values } from "tslib";
import { cloneDeep } from 'lodash';
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { CoreApp, deprecationWarning, rangeUtil, } from '@grafana/data';
import coreModule from 'app/core/core_module';
import { standardAnnotationSupport } from './standardAnnotationSupport';
import { runRequest } from '../query/state/runRequest';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from './api';
var counter = 100;
function getNextRequestId() {
    return 'AQ' + counter++;
}
/**
 * @deprecated AnnotationsSrv is deprecated in favor of DashboardQueryRunner
 */
var AnnotationsSrv = /** @class */ (function () {
    function AnnotationsSrv() {
    }
    /**
     * @deprecated init is deprecated in favor of DashboardQueryRunner.run
     */
    AnnotationsSrv.prototype.init = function (dashboard) {
        deprecationWarning('annotations_srv.ts', 'init', 'DashboardQueryRunner.run');
    };
    /**
     * @deprecated clearPromiseCaches is deprecated
     */
    AnnotationsSrv.prototype.clearPromiseCaches = function () {
        deprecationWarning('annotations_srv.ts', 'clearPromiseCaches', 'DashboardQueryRunner');
    };
    /**
     * @deprecated getAnnotations is deprecated in favor of DashboardQueryRunner.getResult
     */
    AnnotationsSrv.prototype.getAnnotations = function (options) {
        deprecationWarning('annotations_srv.ts', 'getAnnotations', 'DashboardQueryRunner.getResult');
        return Promise.resolve({ annotations: [], alertState: undefined });
    };
    /**
     * @deprecated getAlertStates is deprecated in favor of DashboardQueryRunner.getResult
     */
    AnnotationsSrv.prototype.getAlertStates = function (options) {
        deprecationWarning('annotations_srv.ts', 'getAlertStates', 'DashboardQueryRunner.getResult');
        return Promise.resolve(undefined);
    };
    /**
     * @deprecated getGlobalAnnotations is deprecated in favor of DashboardQueryRunner.getResult
     */
    AnnotationsSrv.prototype.getGlobalAnnotations = function (options) {
        deprecationWarning('annotations_srv.ts', 'getGlobalAnnotations', 'DashboardQueryRunner.getResult');
        return Promise.resolve([]);
    };
    /**
     * @deprecated saveAnnotationEvent is deprecated
     */
    AnnotationsSrv.prototype.saveAnnotationEvent = function (annotation) {
        deprecationWarning('annotations_srv.ts', 'saveAnnotationEvent', 'api/saveAnnotation');
        return saveAnnotation(annotation);
    };
    /**
     * @deprecated updateAnnotationEvent is deprecated
     */
    AnnotationsSrv.prototype.updateAnnotationEvent = function (annotation) {
        deprecationWarning('annotations_srv.ts', 'updateAnnotationEvent', 'api/updateAnnotation');
        return updateAnnotation(annotation);
    };
    /**
     * @deprecated deleteAnnotationEvent is deprecated
     */
    AnnotationsSrv.prototype.deleteAnnotationEvent = function (annotation) {
        deprecationWarning('annotations_srv.ts', 'deleteAnnotationEvent', 'api/deleteAnnotation');
        return deleteAnnotation(annotation);
    };
    /**
     * @deprecated translateQueryResult is deprecated in favor of DashboardQueryRunner/utils/translateQueryResult
     */
    AnnotationsSrv.prototype.translateQueryResult = function (annotation, results) {
        var e_1, _a;
        deprecationWarning('annotations_srv.ts', 'translateQueryResult', 'DashboardQueryRunner/utils/translateQueryResult');
        // if annotation has snapshotData
        // make clone and remove it
        if (annotation.snapshotData) {
            annotation = cloneDeep(annotation);
            delete annotation.snapshotData;
        }
        try {
            for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
                var item = results_1_1.value;
                item.source = annotation;
                item.color = annotation.iconColor;
                item.type = annotation.name;
                item.isRegion = item.timeEnd && item.time !== item.timeEnd;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return results;
    };
    return AnnotationsSrv;
}());
export { AnnotationsSrv };
export function executeAnnotationQuery(options, datasource, savedJsonAnno) {
    var processor = __assign(__assign({}, standardAnnotationSupport), datasource.annotations);
    var annotation = processor.prepareAnnotation(savedJsonAnno);
    if (!annotation) {
        return of({});
    }
    var query = processor.prepareQuery(annotation);
    if (!query) {
        return of({});
    }
    // No more points than pixels
    var maxDataPoints = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    // Add interval to annotation queries
    var interval = rangeUtil.calculateInterval(options.range, maxDataPoints, datasource.interval);
    var scopedVars = {
        __interval: { text: interval.interval, value: interval.interval },
        __interval_ms: { text: interval.intervalMs.toString(), value: interval.intervalMs },
        __annotation: { text: annotation.name, value: annotation },
    };
    var queryRequest = __assign(__assign({ startTime: Date.now(), requestId: getNextRequestId(), range: options.range, maxDataPoints: maxDataPoints, scopedVars: scopedVars }, interval), { app: CoreApp.Dashboard, timezone: options.dashboard.timezone, targets: [
            __assign(__assign({}, query), { refId: 'Anno' }),
        ] });
    return runRequest(datasource, queryRequest).pipe(mergeMap(function (panelData) {
        if (!panelData.series) {
            return of({ panelData: panelData, events: [] });
        }
        return processor.processEvents(annotation, panelData.series).pipe(map(function (events) { return ({ panelData: panelData, events: events }); }));
    }));
}
coreModule.service('annotationsSrv', AnnotationsSrv);
//# sourceMappingURL=annotations_srv.js.map