import { merge, timer } from 'rxjs';
import { mapTo, takeUntil } from 'rxjs/operators';
/**
 * @internal
 */
export function withLoadingIndicator(_a) {
    var whileLoading = _a.whileLoading, source = _a.source;
    return merge(timer(200).pipe(mapTo(whileLoading), takeUntil(source)), source);
}
//# sourceMappingURL=withLoadingIndicator.js.map