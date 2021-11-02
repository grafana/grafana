import { getBackendSrv } from '@grafana/runtime';
export function fetchNotifiers() {
    return getBackendSrv().get("/api/alert-notifiers");
}
//# sourceMappingURL=grafana.js.map