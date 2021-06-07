import React from 'react';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import { isCloudRulesSource } from '../../utils/datasource';
import { DetailsField } from '../DetailsField';
import { Expression } from '../Expression';

type Props = {
  rule: CombinedRule;
  rulesSource: RulesSource;
};

export function RuleDetailsExpression(props: Props): JSX.Element | null {
  const { rulesSource, rule } = props;

  if (!isCloudRulesSource(rulesSource)) {
    return null;
  }

  return (
    <DetailsField label="Expression" horizontal={true}>
      <Expression expression={rule.query} rulesSource={rulesSource} />
    </DetailsField>
  );
}
