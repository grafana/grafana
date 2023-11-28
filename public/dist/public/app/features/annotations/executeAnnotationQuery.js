import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { CoreApp, rangeUtil } from '@grafana/data';
import { runRequest } from '../query/state/runRequest';
import { standardAnnotationSupport } from './standardAnnotationSupport';
let counter = 100;
function getNextRequestId() {
    return 'AQ' + counter++;
}
export function executeAnnotationQuery(options, datasource, savedJsonAnno) {
    var _a;
    const processor = Object.assign(Object.assign({}, standardAnnotationSupport), datasource.annotations);
    const annotationWithDefaults = Object.assign(Object.assign({}, (_a = processor.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(processor)), savedJsonAnno);
    const annotation = processor.prepareAnnotation(annotationWithDefaults);
    if (!annotation) {
        return of({});
    }
    const query = processor.prepareQuery(annotation);
    if (!query) {
        return of({});
    }
    // No more points than pixels
    const maxDataPoints = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    // Add interval to annotation queries
    const interval = rangeUtil.calculateInterval(options.range, maxDataPoints, datasource.interval);
    const scopedVars = {
        __interval: { text: interval.interval, value: interval.interval },
        __interval_ms: { text: interval.intervalMs.toString(), value: interval.intervalMs },
        __annotation: { text: annotation.name, value: annotation },
    };
    const queryRequest = Object.assign(Object.assign({ startTime: Date.now(), requestId: getNextRequestId(), range: options.range, maxDataPoints,
        scopedVars }, interval), { app: CoreApp.Dashboard, timezone: options.dashboard.timezone, targets: [
            Object.assign(Object.assign({}, query), { refId: 'Anno' }),
        ] });
    return runRequest(datasource, queryRequest).pipe(mergeMap((panelData) => {
        // Some annotations set the topic already
        const data = (panelData === null || panelData === void 0 ? void 0 : panelData.series.length) ? panelData.series : panelData.annotations;
        if (!(data === null || data === void 0 ? void 0 : data.length)) {
            return of({ panelData, events: [] });
        }
        return processor.processEvents(annotation, data).pipe(map((events) => ({ panelData, events })));
    }));
}
//# sourceMappingURL=executeAnnotationQuery.js.map