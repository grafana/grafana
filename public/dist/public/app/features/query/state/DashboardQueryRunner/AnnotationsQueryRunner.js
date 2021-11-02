import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { executeAnnotationQuery } from '../../../annotations/annotations_srv';
import { handleAnnotationQueryRunnerError } from './utils';
var AnnotationsQueryRunner = /** @class */ (function () {
    function AnnotationsQueryRunner() {
    }
    AnnotationsQueryRunner.prototype.canRun = function (datasource) {
        if (!datasource) {
            return false;
        }
        return !Boolean(datasource.annotationQuery && !datasource.annotations);
    };
    AnnotationsQueryRunner.prototype.run = function (_a) {
        var annotation = _a.annotation, datasource = _a.datasource, dashboard = _a.dashboard, range = _a.range;
        if (!this.canRun(datasource)) {
            return of([]);
        }
        var panel = {}; // deliberate setting panel to empty object because executeAnnotationQuery shouldn't depend on panelModel
        return executeAnnotationQuery({ dashboard: dashboard, range: range, panel: panel }, datasource, annotation).pipe(map(function (result) {
            var _a;
            return (_a = result.events) !== null && _a !== void 0 ? _a : [];
        }), catchError(handleAnnotationQueryRunnerError));
    };
    return AnnotationsQueryRunner;
}());
export { AnnotationsQueryRunner };
//# sourceMappingURL=AnnotationsQueryRunner.js.map