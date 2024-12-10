import { Observable, of } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';

import {
  DataFrameJSON,
  LoadingState,
  PanelData,
  dataFrameFromJSON,
  getDefaultTimeRange,
  withLoadingIndicator,
} from '@grafana/data';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';

import {
  PreviewRuleRequest,
  PreviewRuleResponse,
  isCloudPreviewRequest,
  isGrafanaPreviewRequest,
} from '../types/preview';
import { RuleFormType } from '../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

export function previewAlertRule(request: PreviewRuleRequest): Observable<PreviewRuleResponse> {
  if (isCloudPreviewRequest(request)) {
    return fetchAlertRulePreview(request, request.dataSourceUid, RuleFormType.cloudAlerting);
  }

  if (isGrafanaPreviewRequest(request)) {
    return fetchAlertRulePreview(request, GRAFANA_RULES_SOURCE_NAME, RuleFormType.grafana);
  }

  throw new Error('unsupported preview rule request');
}

type AlertRulePreviewResponse = {
  instances: DataFrameJSON[];
};

function fetchAlertRulePreview(
  request: PreviewRuleRequest,
  dataSourceUid: string,
  ruleType: RuleFormType
): Observable<PreviewRuleResponse> {
  return withLoadingIndicator({
    whileLoading: createResponse(ruleType),
    source: getBackendSrv()
      .fetch<AlertRulePreviewResponse>({
        method: 'POST',
        url: `/api/v1/rule/test/${dataSourceUid}`,
        data: request,
      })
      .pipe(
        map(({ data }) => {
          return createResponse(ruleType, {
            state: LoadingState.Done,
            series: data.instances.map(dataFrameFromJSON),
          });
        }),
        catchError((error: Error) => {
          return of(
            createResponse(ruleType, {
              state: LoadingState.Error,
              error: toDataQueryError(error),
            })
          );
        }),
        share()
      ),
  });
}

function createResponse(ruleType: RuleFormType, data: Partial<PanelData> = {}): PreviewRuleResponse {
  return {
    ruleType,
    data: {
      state: LoadingState.Loading,
      series: [],
      timeRange: getDefaultTimeRange(),
      ...data,
    },
  };
}
