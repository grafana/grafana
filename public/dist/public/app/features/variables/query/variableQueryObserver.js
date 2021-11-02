import { LoadingState } from '@grafana/data';
export function variableQueryObserver(resolve, reject, subscription) {
    var observer = {
        next: function (results) {
            if (results.state === LoadingState.Error) {
                subscription.unsubscribe();
                reject(results.error);
                return;
            }
            if (results.state === LoadingState.Done) {
                subscription.unsubscribe();
                resolve();
                return;
            }
        },
        error: function (err) {
            subscription.unsubscribe();
            reject(err);
        },
        complete: function () {
            subscription.unsubscribe();
            resolve();
        },
    };
    return observer;
}
//# sourceMappingURL=variableQueryObserver.js.map