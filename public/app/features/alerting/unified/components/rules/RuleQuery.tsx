import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import React, { FC } from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { Expression } from '../Expression';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleQuery: FC<Props> = ({ rule, rulesSource }) => {
  const { rulerRule } = rule;

  if (rulesSource !== GRAFANA_RULES_SOURCE_NAME) {
    return <Expression expression={rule.query} rulesSource={rulesSource} />;
  }
  if (rulerRule && isGrafanaRulerRule(rulerRule)) {
    // @TODO: better grafana queries vizualization
    return <pre>{JSON.stringify(rulerRule.grafana_alert.data, null, 2)}</pre>;
  }
  return <pre>@TODO: handle grafana prom rule case</pre>;
};
