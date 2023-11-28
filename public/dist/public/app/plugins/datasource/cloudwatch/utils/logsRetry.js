import { Observable } from 'rxjs';
import { toDataQueryResponse } from '@grafana/runtime';
/**
 * A retry strategy specifically for cloud watch logs query. Cloud watch logs queries need first starting the query
 * and the polling for the results. The start query can fail because of the concurrent queries rate limit,
 * and so we have to retry the start query call if there is already lot of queries running.
 *
 * As we send multiple queries in a single request some can fail and some can succeed and we have to also handle those
 * cases by only retrying the failed queries. We retry the failed queries until we hit the time limit or all queries
 * succeed and only then we pass the data forward. This means we wait longer but makes the code a bit simpler as we
 * can treat starting the query and polling as steps in a pipeline.
 * @param queryFun
 * @param targets
 * @param options
 */
export function runWithRetry(queryFun, targets, timeoutFunc) {
    const startTime = new Date();
    let retries = 0;
    let timerID;
    let subscription;
    let collected = {};
    const retryWaitFunction = (retry) => {
        return Math.pow(2, retry) * 1000 + Math.random() * 100;
    };
    return new Observable((observer) => {
        // Run function is where the logic takes place. We have it in a function so we can call it recursively.
        function run(currentQueryParams) {
            subscription = queryFun(currentQueryParams).subscribe({
                next(frames) {
                    // In case we successfully finished, merge the current response with whatever we already collected.
                    const collectedPreviously = toDataQueryResponse({ data: { results: collected } }).data || [];
                    observer.next({ frames: [...collectedPreviously, ...frames] });
                    observer.complete();
                },
                error(error) {
                    // In case of error we first try to figure out what kind of error it is
                    var _a, _b, _c, _d;
                    // This means it was a generic 500 error probably so we just pass it on
                    if (typeof error === 'string') {
                        observer.error(error);
                        return;
                    }
                    // In case of multiple queries this some can error while some may be ok
                    const errorData = splitErrorData(error);
                    if (!errorData) {
                        // Not sure what happened but the error structure wasn't what we expected
                        observer.error(error);
                        return;
                    }
                    if (!errorData.errors.length) {
                        // So there is no limit error but some other errors so nothing to retry so we just pass it as it would be
                        // otherwise.
                        observer.error(error);
                        return;
                    }
                    if (timeoutFunc(retries, startTime.valueOf())) {
                        // We timed out but we could have started some queries
                        if (Object.keys(collected).length || Object.keys(errorData.good).length) {
                            const dataResponse = toDataQueryResponse({
                                data: {
                                    results: Object.assign(Object.assign({}, ((_a = errorData.good) !== null && _a !== void 0 ? _a : {})), (collected !== null && collected !== void 0 ? collected : {})),
                                },
                            });
                            dataResponse.error = Object.assign(Object.assign({}, ((_b = dataResponse.error) !== null && _b !== void 0 ? _b : {})), { message: `Some queries timed out: ${errorData.errorMessage}` });
                            // So we consider this a partial success and pass the data forward but also with error to be shown to
                            // the user.
                            observer.next({
                                error: dataResponse.error,
                                frames: dataResponse.data,
                            });
                            observer.complete();
                        }
                        else {
                            // So we timed out and there was no data to pass forward so we just pass the error
                            const dataResponse = toDataQueryResponse({ data: { results: (_d = (_c = error.data) === null || _c === void 0 ? void 0 : _c.results) !== null && _d !== void 0 ? _d : {} } });
                            observer.error(dataResponse.error);
                        }
                        return;
                    }
                    collected = Object.assign(Object.assign({}, collected), errorData.good);
                    timerID = setTimeout(() => {
                        retries++;
                        run(errorData.errors);
                    }, 
                    // We want to know how long to wait for the next retry. First time this will be 0.
                    retryWaitFunction(retries + 1));
                },
            });
        }
        run(targets);
        return () => {
            // We clear only the latest timer and subscription but the observable should complete after one response so
            // there should not be more things running at the same time.
            clearTimeout(timerID);
            subscription.unsubscribe();
        };
    });
}
function splitErrorData(error) {
    var _a;
    const results = (_a = error.data) === null || _a === void 0 ? void 0 : _a.results;
    if (!results) {
        return undefined;
    }
    return Object.keys(results).reduce((acc, refId) => {
        var _a;
        if ((_a = results[refId].error) === null || _a === void 0 ? void 0 : _a.startsWith('LimitExceededException')) {
            acc.errorMessage = results[refId].error;
            acc.errors.push(error.config.data.queries.find((q) => q.refId === refId));
        }
        else {
            acc.good[refId] = results[refId];
        }
        return acc;
    }, { errors: [], good: {}, errorMessage: '' });
}
//# sourceMappingURL=logsRetry.js.map