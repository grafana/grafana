import { dataFrameFromJSON, DataFrameJSON, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {
  CloudPreviewRuleRequest,
  GrafanaPreviewRuleRequest,
  isCloudPreviewRequest,
  isGrafanaPreviewRequest,
  PreviewRuleRequest,
  PreviewRuleResponse,
} from '../types/preview';
import { RuleFormType } from '../types/rule-form';

export async function previewAlertRule(request: PreviewRuleRequest): Promise<PreviewRuleResponse> {
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

async function previewGrafanaAlertRule(request: GrafanaPreviewRuleRequest): Promise<PreviewRuleResponse> {
  const { data } = await getBackendSrv()
    .fetch<GrafanaPreviewRuleResponse>({
      method: 'POST',
      url: `/api/v1/rule/test/grafana`,
      data: request,
    })
    .toPromise();

  return {
    ruleType: RuleFormType.grafana,
    data: {
      state: LoadingState.Done,
      series: data.instances.map(dataFrameFromJSON),
      timeRange: getDefaultTimeRange(),
    },
  };
}

async function previewCloudAlertRule(request: CloudPreviewRuleRequest): Promise<PreviewRuleResponse> {
  throw new Error('preview for cloud alerting rules is not implemented');
}
