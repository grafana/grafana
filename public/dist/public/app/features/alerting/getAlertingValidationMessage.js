import { __awaiter, __generator, __values } from "tslib";
export var getDefaultCondition = function () { return ({
    type: 'query',
    query: { params: ['A', '5m', 'now'] },
    reducer: { type: 'avg', params: [] },
    evaluator: { type: 'gt', params: [null] },
    operator: { type: 'and' },
}); };
export var getAlertingValidationMessage = function (transformations, targets, datasourceSrv, datasource) { return __awaiter(void 0, void 0, void 0, function () {
    var alertingNotSupported, templateVariablesNotSupported, targets_1, targets_1_1, target, dsRef, ds, e_1_1;
    var e_1, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (targets.length === 0) {
                    return [2 /*return*/, 'Could not find any metric queries'];
                }
                if (transformations && transformations.length) {
                    return [2 /*return*/, 'Transformations are not supported in alert queries'];
                }
                alertingNotSupported = 0;
                templateVariablesNotSupported = 0;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 6, 7, 8]);
                targets_1 = __values(targets), targets_1_1 = targets_1.next();
                _b.label = 2;
            case 2:
                if (!!targets_1_1.done) return [3 /*break*/, 5];
                target = targets_1_1.value;
                dsRef = target.datasource || datasource;
                return [4 /*yield*/, datasourceSrv.get(dsRef)];
            case 3:
                ds = _b.sent();
                if (!ds.meta.alerting) {
                    alertingNotSupported++;
                }
                else if (ds.targetContainsTemplate && ds.targetContainsTemplate(target)) {
                    templateVariablesNotSupported++;
                }
                _b.label = 4;
            case 4:
                targets_1_1 = targets_1.next();
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 8];
            case 6:
                e_1_1 = _b.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 8];
            case 7:
                try {
                    if (targets_1_1 && !targets_1_1.done && (_a = targets_1.return)) _a.call(targets_1);
                }
                finally { if (e_1) throw e_1.error; }
                return [7 /*endfinally*/];
            case 8:
                if (alertingNotSupported === targets.length) {
                    return [2 /*return*/, 'The datasource does not support alerting queries'];
                }
                if (templateVariablesNotSupported === targets.length) {
                    return [2 /*return*/, 'Template variables are not supported in alert queries'];
                }
                return [2 /*return*/, ''];
        }
    });
}); };
//# sourceMappingURL=getAlertingValidationMessage.js.map