import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { executeAnnotationQuery } from '../../../annotations/executeAnnotationQuery';
import { handleAnnotationQueryRunnerError } from './utils';
export class AnnotationsQueryRunner {
    canRun(datasource) {
        if (!datasource) {
            return false;
        }
        return Boolean(!datasource.annotationQuery || datasource.annotations);
    }
    run({ annotation, datasource, dashboard, range }) {
        if (!this.canRun(datasource)) {
            return of([]);
        }
        const panel = {}; // deliberate setting panel to empty object because executeAnnotationQuery shouldn't depend on panelModel
        return executeAnnotationQuery({ dashboard, range, panel }, datasource, annotation).pipe(map((result) => {
            var _a;
            return (_a = result.events) !== null && _a !== void 0 ? _a : [];
        }), catchError(handleAnnotationQueryRunnerError));
    }
}
//# sourceMappingURL=AnnotationsQueryRunner.js.map