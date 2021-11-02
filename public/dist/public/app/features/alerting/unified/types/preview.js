export function isCloudPreviewRequest(request) {
    return 'expr' in request;
}
export function isGrafanaPreviewRequest(request) {
    return 'grafana_condition' in request;
}
//# sourceMappingURL=preview.js.map