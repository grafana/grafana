import { GrafanaQuery } from 'app/types/unified-alerting-dto';

export type PreviewRuleRequest = GrafanaPreviewRuleRequest | CloudPreviewRuleRequest;

export type GrafanaPreviewRuleRequest = {
  grafana_condition: {
    condition: string;
    data: GrafanaQuery[];
    now: string;
  };
};

export type CloudPreviewRuleRequest = {
  dataSourceName: string;
  expr: string;
};

export type PreviewRuleResponse = {};

export function isCloudPreviewRequest(request: PreviewRuleRequest): request is CloudPreviewRuleRequest {
  return 'expr' in request;
}

export function isGrafanaPreviewRequest(request: PreviewRuleRequest): request is GrafanaPreviewRuleRequest {
  return 'grafana_condition' in request;
}
