import {
  dataFrameFromJSON,
  DataFrameJSON,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  withLoadingIndicator,
} from '@grafana/data';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';
import { Observable, of } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import {
  CloudPreviewRuleRequest,
  GrafanaPreviewRuleRequest,
  isCloudPreviewRequest,
  isGrafanaPreviewRequest,
  PreviewRuleRequest,
  PreviewRuleResponse,
} from '../types/preview';
import { RuleFormType } from '../types/rule-form';

export function previewAlertRule(request: PreviewRuleRequest): Observable<PreviewRuleResponse> {
  if (isCloudPreviewRequest(request)) {
    return previewCloudAlertRule(request);
  }

  if (isGrafanaPreviewRequest(request)) {
    return previewGrafanaAlertRule(request);
  }

  throw new Error('unsupported preview rule request');
}

type GrafanaPreviewRuleResponse = {
  instances: DataFrameJSON[];
};

function previewGrafanaAlertRule(request: GrafanaPreviewRuleRequest): Observable<PreviewRuleResponse> {
  const type = RuleFormType.grafana;

  return withLoadingIndicator({
    whileLoading: createResponse(type),
    source: getBackendSrv()
      .fetch<GrafanaPreviewRuleResponse>({
        method: 'POST',
        url: `/api/v1/rule/test/grafana`,
        data: request,
      })
      .pipe(
        map(({ data }) => {
          return createResponse(type, {
            state: LoadingState.Done,
            series: data.instances.map(dataFrameFromJSON),
          });
        }),
        catchError((error: Error) => {
          return of(
            createResponse(type, {
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

function previewCloudAlertRule(request: CloudPreviewRuleRequest): Observable<PreviewRuleResponse> {
  throw new Error('preview for cloud alerting rules is not implemented');
}
