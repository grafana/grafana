import { getBackendSrv } from '@grafana/runtime';
export function fetchAnnotations(alertId) {
    return getBackendSrv()
        .get('/api/annotations', {
        alertId,
    })
        .then((result) => {
        return result === null || result === void 0 ? void 0 : result.sort(sortStateHistory);
    });
}
export function sortStateHistory(a, b) {
    const compareDesc = (a, b) => {
        // Larger numbers first.
        if (a > b) {
            return -1;
        }
        if (b > a) {
            return 1;
        }
        return 0;
    };
    const endNeq = compareDesc(a.timeEnd, b.timeEnd);
    if (endNeq) {
        return endNeq;
    }
    const timeNeq = compareDesc(a.time, b.time);
    if (timeNeq) {
        return timeNeq;
    }
    return compareDesc(a.id, b.id);
}
//# sourceMappingURL=annotations.js.map