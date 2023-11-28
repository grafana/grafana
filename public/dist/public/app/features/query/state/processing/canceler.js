import { finalize } from 'rxjs/operators';
export function cancelNetworkRequestsOnUnsubscribe(backendSrv, requestId) {
    return finalize(() => {
        if (requestId) {
            backendSrv.resolveCancelerIfExists(requestId);
        }
    });
}
//# sourceMappingURL=canceler.js.map