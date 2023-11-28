import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
export function saveAnnotation(annotation) {
    return getBackendSrv().post('/api/annotations', annotation);
}
export function updateAnnotation(annotation) {
    return getBackendSrv().put(`/api/annotations/${annotation.id}`, annotation);
}
export function deleteAnnotation(annotation) {
    return getBackendSrv().delete(`/api/annotations/${annotation.id}`);
}
export function getAnnotationTags() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield getBackendSrv().get('/api/annotations/tags');
        return response.result.tags.map(({ tag, count }) => ({
            term: tag,
            count,
        }));
    });
}
//# sourceMappingURL=api.js.map