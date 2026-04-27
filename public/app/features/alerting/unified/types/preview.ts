import type { PanelData } from '@grafana/data/types';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type RuleFormType } from './rule-form';

export type PreviewRuleRequest = GrafanaPreviewRuleRequest | CloudPreviewRuleRequest;

export type GrafanaPreviewRuleRequest = {
  grafana_condition: {
    condition: string;
    data: AlertQuery[];
    now: string;
  };
};

export type CloudPreviewRuleRequest = {
  dataSourceUid: string;
  dataSourceName: string;
  expr: string;
};

export type PreviewRuleResponse = {
  ruleType: RuleFormType;
  data: PanelData;
};

export function isCloudPreviewRequest(request: PreviewRuleRequest): request is CloudPreviewRuleRequest {
  return 'expr' in request;
}

export function isGrafanaPreviewRequest(request: PreviewRuleRequest): request is GrafanaPreviewRuleRequest {
  return 'grafana_condition' in request;
}
