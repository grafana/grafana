import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
export function saveAnnotation(annotation) {
    return getBackendSrv().post('/api/annotations', annotation);
}
export function updateAnnotation(annotation) {
    return getBackendSrv().put("/api/annotations/" + annotation.id, annotation);
}
export function deleteAnnotation(annotation) {
    return getBackendSrv().delete("/api/annotations/" + annotation.id);
}
export function getAnnotationTags() {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/annotations/tags')];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.result.tags.map(function (_a) {
                            var tag = _a.tag, count = _a.count;
                            return ({
                                term: tag,
                                count: count,
                            });
                        })];
            }
        });
    });
}
//# sourceMappingURL=api.js.map