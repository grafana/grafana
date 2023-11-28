import { of } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { dataFrameFromJSON, getDefaultTimeRange, LoadingState, withLoadingIndicator, } from '@grafana/data';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';
import { isCloudPreviewRequest, isGrafanaPreviewRequest, } from '../types/preview';
import { RuleFormType } from '../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
export function previewAlertRule(request) {
    if (isCloudPreviewRequest(request)) {
        return fetchAlertRulePreview(request, request.dataSourceUid, RuleFormType.cloudAlerting);
    }
    if (isGrafanaPreviewRequest(request)) {
        return fetchAlertRulePreview(request, GRAFANA_RULES_SOURCE_NAME, RuleFormType.grafana);
    }
    throw new Error('unsupported preview rule request');
}
function fetchAlertRulePreview(request, dataSourceUid, ruleType) {
    return withLoadingIndicator({
        whileLoading: createResponse(ruleType),
        source: getBackendSrv()
            .fetch({
            method: 'POST',
            url: `/api/v1/rule/test/${dataSourceUid}`,
            data: request,
        })
            .pipe(map(({ data }) => {
            return createResponse(ruleType, {
                state: LoadingState.Done,
                series: data.instances.map(dataFrameFromJSON),
            });
        }), catchError((error) => {
            return of(createResponse(ruleType, {
                state: LoadingState.Error,
                error: toDataQueryError(error),
            }));
        }), share()),
    });
}
function createResponse(ruleType, data = {}) {
    return {
        ruleType,
        data: Object.assign({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() }, data),
    };
}
//# sourceMappingURL=preview.js.map