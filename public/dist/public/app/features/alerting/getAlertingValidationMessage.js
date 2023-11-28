import { __awaiter } from "tslib";
export const getDefaultCondition = () => ({
    type: 'query',
    query: { params: ['A', '5m', 'now'] },
    reducer: { type: 'avg', params: [] },
    evaluator: { type: 'gt', params: [null] },
    operator: { type: 'and' },
});
export const getAlertingValidationMessage = (transformations, targets, datasourceSrv, datasource) => __awaiter(void 0, void 0, void 0, function* () {
    if (targets.length === 0) {
        return 'Could not find any metric queries';
    }
    if (transformations && transformations.length) {
        return 'Transformations are not supported in alert queries';
    }
    let alertingNotSupported = 0;
    let templateVariablesNotSupported = 0;
    for (const target of targets) {
        const dsRef = target.datasource || datasource;
        const ds = yield datasourceSrv.get(dsRef);
        if (!ds.meta.alerting) {
            alertingNotSupported++;
        }
        else if (ds.targetContainsTemplate && ds.targetContainsTemplate(target)) {
            templateVariablesNotSupported++;
        }
    }
    if (alertingNotSupported === targets.length) {
        return 'The datasource does not support alerting queries';
    }
    if (templateVariablesNotSupported === targets.length) {
        return 'Template variables are not supported in alert queries';
    }
    return '';
});
//# sourceMappingURL=getAlertingValidationMessage.js.map