import { LoadingState } from '@grafana/data';
export function variableQueryObserver(resolve, reject, subscription) {
    const observer = {
        next: (results) => {
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
        error: (err) => {
            subscription.unsubscribe();
            reject(err);
        },
        complete: () => {
            subscription.unsubscribe();
            resolve();
        },
    };
    return observer;
}
//# sourceMappingURL=variableQueryObserver.js.map