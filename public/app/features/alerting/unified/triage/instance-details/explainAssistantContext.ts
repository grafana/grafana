import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';
import { type Labels } from '@grafana/data';
import { type GrafanaAlertState, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

export interface ExplainAssistantContextParams {
  rule: RulerGrafanaRuleDTO;
  ruleUID: string;
  instanceLabels: Labels;
  commonLabels?: Labels;
  instanceState?: GrafanaAlertState;
  description: string;
}

function serializeAlertQueries(rule: RulerGrafanaRuleDTO) {
  return rule.grafana_alert.data.map((query) => {
    const model = query.model;
    let expr: string | undefined;

    if (model && typeof model === 'object' && 'expr' in model && typeof model.expr === 'string') {
      expr = model.expr;
    }

    return {
      refId: query.refId,
      datasourceUid: query.datasourceUid,
      expr,
      expression: query.model.expression,
    };
  });
}

export function createExplainAssistantContext({
  rule,
  ruleUID,
  instanceLabels,
  commonLabels,
  instanceState,
  description,
}: ExplainAssistantContextParams): ChatContextItem[] {
  const ruleTitle = rule.grafana_alert.title;

  return [
    createAssistantContextItem('structured', {
      title: `Alert instance: ${ruleTitle}`,
      data: {
        rule: {
          uid: ruleUID,
          title: ruleTitle,
          labels: rule.labels,
          annotations: rule.annotations,
          condition: rule.grafana_alert.condition,
          queries: serializeAlertQueries(rule),
        },
        instance: {
          labels: instanceLabels,
          commonLabels,
          state: instanceState,
        },
        description,
      },
    }),
  ];
}
