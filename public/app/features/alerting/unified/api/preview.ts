import { getBackendSrv } from '@grafana/runtime';
import {
  CloudPreviewRuleRequest,
  GrafanaPreviewRuleRequest,
  isCloudPreviewRequest,
  isGrafanaPreviewRequest,
  PreviewRuleRequest,
  PreviewRuleResponse,
} from '../types/preview';
import { getDatasourceAPIId } from '../utils/datasource';

export async function previewAlertRule(request: PreviewRuleRequest): Promise<PreviewRuleResponse> {
  if (isCloudPreviewRequest(request)) {
    return previewCloudAlertRule(request);
  }

  if (isGrafanaPreviewRequest(request)) {
    return previewGrafanaAlertRule(request);
  }

  throw new Error('');
}

type GrafanaPreviewRuleResponse = {};

async function previewGrafanaAlertRule(request: GrafanaPreviewRuleRequest): Promise<PreviewRuleResponse> {
  const { data } = await getBackendSrv()
    .fetch<GrafanaPreviewRuleResponse>({
      method: 'POST',
      url: `/api/v1/rule/test/grafana`,
      data: request,
    })
    .toPromise();

  console.log('grafana repsonse', data);

  return data;
}

type CloudPreviewRuleResponse = {};

async function previewCloudAlertRule(request: CloudPreviewRuleRequest): Promise<PreviewRuleResponse> {
  const { dataSourceName, expr } = request;

  const { data } = await getBackendSrv()
    .fetch<CloudPreviewRuleResponse>({
      method: 'POST',
      url: `/api/v1/rule/test/${getDatasourceAPIId(dataSourceName)}`,
      data: { expr },
    })
    .toPromise();

  console.log('cloud repsonse', data);

  return data;
}
