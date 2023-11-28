import { from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { shouldUseLegacyRunner } from 'app/features/annotations/standardAnnotationSupport';
import { handleAnnotationQueryRunnerError } from './utils';
export class LegacyAnnotationQueryRunner {
    canRun(datasource) {
        if (!datasource) {
            return false;
        }
        if (shouldUseLegacyRunner(datasource)) {
            return true;
        }
        return Boolean(datasource.annotationQuery && !datasource.annotations);
    }
    run({ annotation, datasource, dashboard, range }) {
        if (!this.canRun(datasource)) {
            return of([]);
        }
        return from(datasource.annotationQuery({ range, rangeRaw: range.raw, annotation, dashboard })).pipe(catchError(handleAnnotationQueryRunnerError));
    }
}
//# sourceMappingURL=LegacyAnnotationQueryRunner.js.map