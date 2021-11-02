import { from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { handleAnnotationQueryRunnerError } from './utils';
var LegacyAnnotationQueryRunner = /** @class */ (function () {
    function LegacyAnnotationQueryRunner() {
    }
    LegacyAnnotationQueryRunner.prototype.canRun = function (datasource) {
        if (!datasource) {
            return false;
        }
        return Boolean(datasource.annotationQuery && !datasource.annotations);
    };
    LegacyAnnotationQueryRunner.prototype.run = function (_a) {
        var annotation = _a.annotation, datasource = _a.datasource, dashboard = _a.dashboard, range = _a.range;
        if (!this.canRun(datasource)) {
            return of([]);
        }
        return from(datasource.annotationQuery({ range: range, rangeRaw: range.raw, annotation: annotation, dashboard: dashboard })).pipe(catchError(handleAnnotationQueryRunnerError));
    };
    return LegacyAnnotationQueryRunner;
}());
export { LegacyAnnotationQueryRunner };
//# sourceMappingURL=LegacyAnnotationQueryRunner.js.map