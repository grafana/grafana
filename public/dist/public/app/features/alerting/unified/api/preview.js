import { __assign } from "tslib";
import { dataFrameFromJSON, getDefaultTimeRange, LoadingState, withLoadingIndicator, } from '@grafana/data';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';
import { of } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { isCloudPreviewRequest, isGrafanaPreviewRequest, } from '../types/preview';
import { RuleFormType } from '../types/rule-form';
export function previewAlertRule(request) {
    if (isCloudPreviewRequest(request)) {
        return previewCloudAlertRule(request);
    }
    if (isGrafanaPreviewRequest(request)) {
        return previewGrafanaAlertRule(request);
    }
    throw new Error('unsupported preview rule request');
}
function previewGrafanaAlertRule(request) {
    var type = RuleFormType.grafana;
    return withLoadingIndicator({
        whileLoading: createResponse(type),
        source: getBackendSrv()
            .fetch({
            method: 'POST',
            url: "/api/v1/rule/test/grafana",
            data: request,
        })
            .pipe(map(function (_a) {
            var data = _a.data;
            return createResponse(type, {
                state: LoadingState.Done,
                series: data.instances.map(dataFrameFromJSON),
            });
        }), catchError(function (error) {
            return of(createResponse(type, {
                state: LoadingState.Error,
                error: toDataQueryError(error),
            }));
        }), share()),
    });
}
function createResponse(ruleType, data) {
    if (data === void 0) { data = {}; }
    return {
        ruleType: ruleType,
        data: __assign({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() }, data),
    };
}
function previewCloudAlertRule(request) {
    throw new Error('preview for cloud alerting rules is not implemented');
}
//# sourceMappingURL=preview.js.map