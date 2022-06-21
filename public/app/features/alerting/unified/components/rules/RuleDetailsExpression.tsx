import { css, cx } from '@emotion/css';
import React from 'react';

import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { isCloudRulesSource } from '../../utils/datasource';
import { DetailsField } from '../DetailsField';
import { Expression } from '../Expression';

type Props = {
  rule: CombinedRule;
  rulesSource: RulesSource;
  annotations: Array<[string, string]>;
};

export function RuleDetailsExpression(props: Props): JSX.Element | null {
  const { annotations, rulesSource, rule } = props;
  const styles = getStyles();

  if (!isCloudRulesSource(rulesSource)) {
    return null;
  }

  return (
    <DetailsField label="Expression" horizontal={true} className={cx({ [styles.exprRow]: !!annotations.length })}>
      <Expression expression={rule.query} rulesSource={rulesSource} />
    </DetailsField>
  );
}

const getStyles = () => ({
  exprRow: css`
    margin-bottom: 46px;
  `,
});
